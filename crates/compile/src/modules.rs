//! The rewrite of a transformed module's `import` and `export` declarations into calls of
//! `__import` and `__exports`, by splicing the text of each top-level declaration rather than by
//! building AST nodes.
//!
//! An import gives the value of the binding when the import runs, not a live binding. Each export
//! is a getter on `__exports`, defined first in the body so a module that imports this one back
//! while it runs finds every name, as with ES modules; only `export default <expression>` is
//! assigned where it stands.

use oxc_allocator::Allocator;
use oxc_ast::ast::{
    Declaration, ExportAllDeclaration, ExportDefaultDeclaration, ExportDefaultDeclarationKind,
    ExportFromDeclaration, ImportDeclaration, ImportDeclarationSpecifier, ModuleDeclaration,
    ModuleExportName,
};
use oxc_parser::Parser;
use oxc_span::{GetSpan, SourceType, Span};

use crate::Compiled;

/// The directive that runs the body in strict mode, as a module runs: a function body is
/// sloppy without it.
const STRICT: &str = "\"use strict\";";

/// Rewrites `code`, a JavaScript module, into the body of a function `(__import, __exports)`.
pub(crate) fn rewrite(code: &str) -> Result<Compiled, String> {
    let allocator = Allocator::default();
    let parsed = Parser::new(&allocator, code, SourceType::mjs()).parse();
    if let Some(diagnostic) = parsed.diagnostics.errors().next() {
        return Err(diagnostic.message.to_string());
    }
    let program = parsed.program;
    let start = program
        .hashbang
        .as_ref()
        .map_or(0, |hashbang| hashbang.span.end);
    let after_directives = program
        .directives
        .last()
        .map_or(start, |directive| directive.span.end);
    let mut rewriter = Rewriter {
        code,
        getters: String::new(),
        imports: Vec::new(),
        modules: 0,
    };
    let mut body = String::new();
    let mut cursor = after_directives;
    for statement in &program.body {
        let Some(declaration) = statement.as_module_declaration() else {
            continue;
        };
        let span = declaration.span();
        body.push_str(text(code, Span::new(cursor, span.start)));
        body.push_str(&rewriter.declaration(declaration)?);
        cursor = span.end;
    }
    body.push_str(&code[cursor as usize..]);
    let head = text(code, Span::new(start, after_directives)).trim_start();
    let separator = if head.is_empty() { "" } else { "\n" };
    Ok(Compiled {
        code: format!("{STRICT}\n{head}{separator}{}{body}", rewriter.getters),
        imports: rewriter.imports,
    })
}

/// The state of one rewrite: the getters to place first, the imports seen, and the number of
/// module variables named so far.
struct Rewriter<'c> {
    code: &'c str,
    getters: String,
    imports: Vec<String>,
    modules: usize,
}

impl Rewriter<'_> {
    /// The text that replaces one module declaration.
    fn declaration(&mut self, declaration: &ModuleDeclaration) -> Result<String, String> {
        match declaration {
            ModuleDeclaration::ImportDeclaration(import) => Ok(self.import(import)),
            ModuleDeclaration::ExportDeclaration(export) => self.export(&export.declaration),
            ModuleDeclaration::ExportNamedDeclaration(export) => {
                for specifier in &export.specifiers {
                    let local = self.local_name(&specifier.local);
                    self.getter(&specifier.exported, &local);
                }
                Ok(String::new())
            }
            ModuleDeclaration::ExportFromDeclaration(export) => Ok(self.export_from(export)),
            ModuleDeclaration::ExportAllDeclaration(export) => Ok(self.export_all(export)),
            ModuleDeclaration::ExportDefaultDeclaration(export) => Ok(self.export_default(export)),
            ModuleDeclaration::TSExportAssignment(_)
            | ModuleDeclaration::TSNamespaceExportDeclaration(_) => {
                Err("a TypeScript export is left".to_owned())
            }
        }
    }

    /// `import d, { a, b as c } from "x"` → `const __m0 = __import("x"); const d = __m0.default;
    /// const { a, b: c } = __m0;`, `import * as n from "x"` → `const n = __import("x");`, and
    /// `import "x"` → `__import("x");`.
    fn import(&mut self, import: &ImportDeclaration) -> String {
        let call = self.call(import.source.span, &import.source.value);
        let specifiers = import
            .specifiers
            .as_ref()
            .map_or(&[][..], |specifiers| specifiers.as_slice());
        if specifiers.is_empty() {
            return format!("{call};");
        }
        let namespace = specifiers.iter().find_map(|specifier| match specifier {
            ImportDeclarationSpecifier::ImportNamespaceSpecifier(namespace) => {
                Some(namespace.local.name.to_string())
            }
            _ => None,
        });
        let module = namespace.unwrap_or_else(|| self.module_name());
        let mut out = format!("const {module} = {call};");
        let mut named = Vec::new();
        for specifier in specifiers {
            match specifier {
                ImportDeclarationSpecifier::ImportDefaultSpecifier(default) => {
                    out.push_str(&format!(
                        " const {} = {module}.default;",
                        default.local.name
                    ));
                }
                ImportDeclarationSpecifier::ImportSpecifier(specifier) => {
                    let local = specifier.local.name.as_str();
                    named.push(match &specifier.imported {
                        ModuleExportName::StringLiteral(literal) => {
                            format!("{}: {local}", text(self.code, literal.span))
                        }
                        imported if imported.name() == local => local.to_owned(),
                        imported => format!("{}: {local}", imported.name()),
                    });
                }
                ImportDeclarationSpecifier::ImportNamespaceSpecifier(_) => {}
            }
        }
        if !named.is_empty() {
            out.push_str(&format!(" const {{ {} }} = {module};", named.join(", ")));
        }
        out
    }

    /// `export const|let|var|function|class` → the declaration, and a getter for each name.
    fn export(&mut self, declaration: &Declaration) -> Result<String, String> {
        let names: Vec<String> = match declaration {
            Declaration::VariableDeclaration(variables) => variables
                .declarations
                .iter()
                .flat_map(|declarator| declarator.id.get_binding_identifiers())
                .map(|identifier| identifier.name.to_string())
                .collect(),
            Declaration::FunctionDeclaration(function) => {
                function.id.iter().map(|id| id.name.to_string()).collect()
            }
            Declaration::ClassDeclaration(class) => {
                class.id.iter().map(|id| id.name.to_string()).collect()
            }
            _ => return Err("a TypeScript declaration is left".to_owned()),
        };
        for name in names {
            self.getters
                .push_str(&getter_text(&format!("\"{name}\""), &name));
        }
        Ok(text(self.code, declaration.span()).to_owned())
    }

    /// `export { a, b as c } from "x"` → an import of `x` and a getter for each name.
    fn export_from(&mut self, export: &ExportFromDeclaration) -> String {
        let module = self.module_name();
        let call = self.call(export.source.span, &export.source.value);
        for specifier in &export.specifiers {
            let target = match &specifier.local {
                ModuleExportName::StringLiteral(literal) => {
                    format!("{module}[{}]", text(self.code, literal.span))
                }
                local => format!("{module}.{}", local.name()),
            };
            self.getter(&specifier.exported, &target);
        }
        format!("const {module} = {call};")
    }

    /// `export * as n from "x"` → an import and a getter; `export * from "x"` → a getter for each
    /// key of `x` but `default` and the names this module exports itself.
    fn export_all(&mut self, export: &ExportAllDeclaration) -> String {
        let module = self.module_name();
        let call = self.call(export.source.span, &export.source.value);
        if let Some(exported) = &export.exported {
            self.getter(exported, &module);
            return format!("const {module} = {call};");
        }
        format!(
            "const {module} = {call}; for (const __k of Object.keys({module})) if (__k !== \"default\" \
             && !Object.prototype.hasOwnProperty.call(__exports, __k)) Object.defineProperty(__exports, \
             __k, {{ enumerable: true, get: () => {module}[__k] }});"
        )
    }

    /// `export default function f` or `class C` → the declaration and a getter;
    /// `export default <expression>` → `__exports.default = (<expression>);`.
    fn export_default(&mut self, export: &ExportDefaultDeclaration) -> String {
        let name = match &export.declaration {
            ExportDefaultDeclarationKind::FunctionDeclaration(function) => function.id.as_ref(),
            ExportDefaultDeclarationKind::ClassDeclaration(class) => class.id.as_ref(),
            ExportDefaultDeclarationKind::TSInterfaceDeclaration(_) => return String::new(),
            _ => None,
        };
        let declaration = text(self.code, export.declaration.span());
        if let Some(name) = name {
            self.getters
                .push_str(&getter_text("\"default\"", &name.name));
            return declaration.to_owned();
        }
        format!("__exports.default = ({declaration});")
    }

    /// `__import(<source>)`, noting the source among the imports.
    fn call(&mut self, span: Span, source: &str) -> String {
        if !self.imports.iter().any(|import| import == source) {
            self.imports.push(source.to_owned());
        }
        format!("__import({})", text(self.code, span))
    }

    /// A new name for a module's value, `__m0`, `__m1`, and so on, skipping any that the code
    /// already holds, so it never shadows nor is shadowed by a name of the file.
    fn module_name(&mut self) -> String {
        loop {
            let name = format!("__m{}", self.modules);
            self.modules += 1;
            if !self.code.contains(&name) {
                return name;
            }
        }
    }

    /// The local name an `export { … }` specifier reads.
    fn local_name(&self, local: &ModuleExportName) -> String {
        match local {
            ModuleExportName::StringLiteral(literal) => text(self.code, literal.span).to_owned(),
            local => local.name().to_string(),
        }
    }

    /// Adds a getter for the exported name, returning `target`.
    fn getter(&mut self, exported: &ModuleExportName, target: &str) {
        let name = match exported {
            ModuleExportName::StringLiteral(literal) => text(self.code, literal.span).to_owned(),
            exported => format!("\"{}\"", exported.name()),
        };
        self.getters.push_str(&getter_text(&name, target));
    }
}

/// `Object.defineProperty(__exports, <name>, { enumerable: true, get: () => <target> });`, on its
/// own line.
fn getter_text(name: &str, target: &str) -> String {
    format!(
        "Object.defineProperty(__exports, {name}, {{ enumerable: true, get: () => {target} }});\n"
    )
}

/// The text of `span` in `code`.
fn text(code: &str, span: Span) -> &str {
    &code[span.start as usize..span.end as usize]
}
