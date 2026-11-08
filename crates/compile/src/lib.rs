//! Compiles one extension file, TypeScript or TSX, into the body of a function called as
//! `f(__import, __exports)`: types stripped, JSX turned into `react/jsx-runtime` calls, and every
//! `import` and `export` rewritten into calls of those two parameters. The same output runs in the
//! server, inside `vm`, and in the page, so both have one module runner and no module cache that
//! keeps an old version alive.
//!
//! Linked only into the Node binding, never into `ura`.

mod modules;

use std::path::Path;

use oxc_allocator::Allocator;
use oxc_ast::ast::{
    ArrowFunctionExpression, AwaitExpression, ForOfStatement, Function, Program,
    VariableDeclaration, VariableDeclarationKind,
};
use oxc_ast_visit::{Visit, walk};
use oxc_codegen::Codegen;
use oxc_diagnostics::OxcDiagnostic;
use oxc_parser::{Parser, ParserReturn};
use oxc_semantic::{ScopeFlags, SemanticBuilder};
use oxc_span::SourceType;
use oxc_transformer::{JsxOptions, JsxRuntime, TransformOptions, Transformer};

/// A compiled file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Compiled {
    /// The body of a function called as `f(__import, __exports)`.
    pub code: String,
    /// Every module the file imports, in the order the code imports them, each once.
    pub imports: Vec<String>,
}

/// Why a file did not compile, at a position of its source: line and column count from 1, the
/// column in characters.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CompileError {
    pub line: u32,
    pub column: u32,
    pub message: String,
}

const TOP_LEVEL_AWAIT: &str = "top-level await is not supported: load in the function you export";
const DYNAMIC_IMPORT: &str = "dynamic import is not supported";
const IMPORT_META: &str = "import.meta is not supported";

/// Compiles `source`, read from a file called `filename`, whose extension picks the syntax: `.ts`
/// without JSX, `.tsx` with it.
pub fn compile(source: &str, filename: &str) -> Result<Compiled, CompileError> {
    let source_type = SourceType::from_path(filename)
        .map_err(|_| error_at(source, 0, format!("{filename} is not a TypeScript file")))?
        .with_module(true);
    let allocator = Allocator::default();
    let ParserReturn {
        mut program,
        module_record,
        diagnostics,
        ..
    } = Parser::new(&allocator, source, source_type).parse();
    if let Some(diagnostic) = diagnostics.errors().next() {
        return Err(diagnostic_error(source, diagnostic));
    }
    let mut refusals: Vec<(u32, &str)> = module_record
        .dynamic_imports
        .iter()
        .map(|import| (import.span.start, DYNAMIC_IMPORT))
        .chain(
            module_record
                .import_metas
                .iter()
                .map(|span| (span.start, IMPORT_META)),
        )
        .collect();
    let mut awaits = TopLevelAwaits::default();
    awaits.visit_program(&program);
    refusals.extend(
        awaits
            .found
            .into_iter()
            .map(|start| (start, TOP_LEVEL_AWAIT)),
    );
    if let Some((start, message)) = refusals.into_iter().min_by_key(|(start, _)| *start) {
        return Err(error_at(source, start, message.to_owned()));
    }
    let code = transform(&allocator, &mut program, filename, source)?;
    modules::rewrite(&code).map_err(|message| {
        error_at(
            source,
            0,
            format!("the compiled file is invalid: {message}"),
        )
    })
}

/// Strips the types and turns the JSX into `react/jsx-runtime` calls, then prints the module.
fn transform<'a>(
    allocator: &'a Allocator,
    program: &mut Program<'a>,
    filename: &str,
    source: &str,
) -> Result<String, CompileError> {
    let semantic = SemanticBuilder::new()
        .with_check_syntax_error(true)
        .with_enum_eval(true)
        .build(program);
    if let Some(diagnostic) = semantic.diagnostics.errors().next() {
        return Err(diagnostic_error(source, diagnostic));
    }
    let scoping = semantic.semantic.into_scoping();
    let options = TransformOptions {
        jsx: JsxOptions {
            runtime: JsxRuntime::Automatic,
            import_source: Some("react".to_owned()),
            ..JsxOptions::enable()
        },
        ..TransformOptions::default()
    };
    let transformed = Transformer::new(allocator, Path::new(filename), &options)
        .build_with_scoping(scoping, program);
    if let Some(diagnostic) = transformed.diagnostics.errors().next() {
        return Err(diagnostic_error(source, diagnostic));
    }
    Ok(Codegen::new().build(program).code)
}

/// The starts of every `await` outside a function: an expression, `for await`, or `await using`.
#[derive(Default)]
struct TopLevelAwaits {
    depth: u32,
    found: Vec<u32>,
}

impl<'a> Visit<'a> for TopLevelAwaits {
    fn visit_function(&mut self, it: &Function<'a>, flags: ScopeFlags) {
        self.depth += 1;
        walk::walk_function(self, it, flags);
        self.depth -= 1;
    }

    fn visit_arrow_function_expression(&mut self, it: &ArrowFunctionExpression<'a>) {
        self.depth += 1;
        walk::walk_arrow_function_expression(self, it);
        self.depth -= 1;
    }

    fn visit_await_expression(&mut self, it: &AwaitExpression<'a>) {
        if self.depth == 0 {
            self.found.push(it.span.start);
        }
        walk::walk_await_expression(self, it);
    }

    fn visit_for_of_statement(&mut self, it: &ForOfStatement<'a>) {
        if self.depth == 0 && it.r#await {
            self.found.push(it.span.start);
        }
        walk::walk_for_of_statement(self, it);
    }

    fn visit_variable_declaration(&mut self, it: &VariableDeclaration<'a>) {
        if self.depth == 0 && it.kind == VariableDeclarationKind::AwaitUsing {
            self.found.push(it.span.start);
        }
        walk::walk_variable_declaration(self, it);
    }
}

/// An oxc diagnostic as an error at its first label, or at the start of the file.
fn diagnostic_error(source: &str, diagnostic: &OxcDiagnostic) -> CompileError {
    let offset = diagnostic.labels.first().map_or(0, |label| label.offset());
    error_at(source, offset, diagnostic.message.to_string())
}

/// An error at a byte offset of `source`.
fn error_at(source: &str, offset: u32, message: String) -> CompileError {
    let mut offset = (offset as usize).min(source.len());
    while !source.is_char_boundary(offset) {
        offset -= 1;
    }
    let before = &source[..offset];
    let line_start = before.rfind('\n').map_or(0, |index| index + 1);
    let count = |n: usize| u32::try_from(n).unwrap_or(u32::MAX);
    CompileError {
        line: count(before.matches('\n').count()) + 1,
        column: count(before[line_start..].chars().count()) + 1,
        message,
    }
}
