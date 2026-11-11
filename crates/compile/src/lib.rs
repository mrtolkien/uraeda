//! Compiles one extension file, TypeScript or TSX, into the body of a function called as
//! `f(__import, __exports)`: types stripped, JSX turned into `react/jsx-runtime` calls, and every
//! `import` and `export` rewritten into calls of those two parameters. The same output runs in the
//! server, inside `vm`, and in the page, so both have one module runner and no module cache that
//! keeps an old version alive.
//!
//! Linked into the Node binding, and into the server, whose VM runs an extension's server files.

mod modules;

use std::path::Path;

use oxc_allocator::Allocator;
use oxc_ast::ast::{
    ArrowFunctionExpression, AwaitExpression, ForOfStatement, Function, Program,
    TSExportAssignment, TSImportEqualsDeclaration, TSModuleReference, VariableDeclaration,
    VariableDeclarationKind,
};
use oxc_ast_visit::{Visit, walk};
use oxc_codegen::Codegen;
use oxc_diagnostics::OxcDiagnostic;
use oxc_parser::{Parser, ParserReturn};
use oxc_semantic::{ScopeFlags, SemanticBuilder};
use oxc_span::{GetSpan, SourceType, Span};
use oxc_syntax::module_record::{ExportExportName, ModuleRecord};
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
    let typescript = |extension: &str| {
        filename
            .strip_suffix(extension)
            .is_some_and(|stem| !stem.is_empty() && !stem.ends_with(".d"))
    };
    let source_type = (typescript(".ts") || typescript(".tsx"))
        .then(|| SourceType::from_path(filename).ok())
        .flatten()
        .ok_or_else(|| error_at(source, 0, format!("{filename} is not a TypeScript file")))?
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
    let mut refusals: Vec<(u32, String)> = module_record
        .dynamic_imports
        .iter()
        .map(|import| (import.span.start, DYNAMIC_IMPORT.to_owned()))
        .chain(
            module_record
                .import_metas
                .iter()
                .map(|span| (span.start, IMPORT_META.to_owned())),
        )
        .chain(duplicate_exports(&program, &module_record))
        .collect();
    let mut refused = Refusals::default();
    refused.visit_program(&program);
    refusals.extend(refused.found);
    if let Some((start, message)) = refusals.into_iter().min_by_key(|(start, _)| *start) {
        return Err(error_at(source, start, message));
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

/// Each name exported a second time, at its second export, which the module rewrite would refuse
/// without a position: TypeScript's parse leaves them, as an overload, a type, or a merged enum
/// may share a name, so only the exports of values count.
fn duplicate_exports(program: &Program, record: &ModuleRecord) -> Vec<(u32, String)> {
    let types: Vec<Span> = program
        .body
        .iter()
        .filter(|statement| statement.is_typescript_syntax())
        .map(GetSpan::span)
        .collect();
    let mut seen: Vec<String> = Vec::new();
    let mut found = Vec::new();
    let entries = record
        .local_export_entries
        .iter()
        .chain(&record.indirect_export_entries)
        .filter(|entry| !entry.is_type && !types.contains(&entry.statement_span));
    for entry in entries {
        let (name, span) = match &entry.export_name {
            ExportExportName::Name(name) => (name.name.to_string(), name.span),
            ExportExportName::Default(span) => ("default".to_owned(), *span),
            ExportExportName::Null => continue,
        };
        if seen.contains(&name) {
            found.push((span.start, format!("{name} is exported twice")));
        } else {
            seen.push(name);
        }
    }
    found
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

/// What the function body cannot run, each at its start: an `await` outside a function (an
/// expression, `for await`, or `await using`), `import x = require("y")`, and `export =`.
#[derive(Default)]
struct Refusals {
    depth: u32,
    found: Vec<(u32, String)>,
}

impl Refusals {
    fn top_level_await(&mut self, start: u32) {
        if self.depth == 0 {
            self.found.push((start, TOP_LEVEL_AWAIT.to_owned()));
        }
    }
}

impl<'a> Visit<'a> for Refusals {
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
        self.top_level_await(it.span.start);
        walk::walk_await_expression(self, it);
    }

    fn visit_for_of_statement(&mut self, it: &ForOfStatement<'a>) {
        if it.r#await {
            self.top_level_await(it.span.start);
        }
        walk::walk_for_of_statement(self, it);
    }

    fn visit_variable_declaration(&mut self, it: &VariableDeclaration<'a>) {
        if it.kind == VariableDeclarationKind::AwaitUsing {
            self.top_level_await(it.span.start);
        }
        walk::walk_variable_declaration(self, it);
    }

    fn visit_ts_import_equals_declaration(&mut self, it: &TSImportEqualsDeclaration<'a>) {
        if let TSModuleReference::ExternalModuleReference(module) = &it.module_reference {
            let message = format!(
                "import = require is not supported: use import {} from \"{}\"",
                it.id.name, module.expression.value
            );
            self.found.push((it.span.start, message));
        }
        walk::walk_ts_import_equals_declaration(self, it);
    }

    fn visit_ts_export_assignment(&mut self, it: &TSExportAssignment<'a>) {
        let message = "export = is not supported: use export default".to_owned();
        self.found.push((it.span.start, message));
        walk::walk_ts_export_assignment(self, it);
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
