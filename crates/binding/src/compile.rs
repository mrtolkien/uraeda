//! The compiler of extension files, `uraeda-compile`, for the server's loader. Synchronous: a file
//! takes about 2 ms.

use napi_derive::napi;

/// A compiled file: `code` is the body of a function called as `f(__import, __exports)`, and
/// `imports` every module it imports, in order. When the file does not compile, `error` says where
/// and why, and `code` and `imports` are empty.
#[napi(object, use_nullable = true)]
pub struct CompiledModule {
    pub code: String,
    pub imports: Vec<String>,
    pub error: Option<CompileModuleError>,
}

/// Why a file did not compile, at a line and a column of its source, both counted from 1.
#[napi(object)]
pub struct CompileModuleError {
    pub line: u32,
    pub column: u32,
    pub message: String,
}

/// Compiles one TypeScript or TSX file, whose `filename` extension picks the syntax.
#[napi(catch_unwind)]
pub fn compile_module(source: String, filename: String) -> CompiledModule {
    match uraeda_compile::compile(&source, &filename) {
        Ok(compiled) => CompiledModule {
            code: compiled.code,
            imports: compiled.imports,
            error: None,
        },
        Err(error) => CompiledModule {
            code: String::new(),
            imports: Vec::new(),
            error: Some(CompileModuleError {
                line: error.line,
                column: error.column,
                message: error.message,
            }),
        },
    }
}
