//! The compiler's contract: the text it emits has no module statement left, lists every import in
//! order, and refuses what the function body cannot run, at the line and column of the source. The
//! server's loader tests run the output for real.

use uraeda_compile::{CompileError, compile};

/// Whether `code` still holds an ES module statement, which `vm` refuses at run time.
fn has_module_statement(code: &str) -> bool {
    code.lines().any(|line| {
        let line = line.trim_start();
        line.starts_with("import ") || line.starts_with("import{") || line.starts_with("export ")
    })
}

/// Source, file name, the imports in order, and fragments the code must contain.
type Row = (
    &'static str,
    &'static str,
    &'static [&'static str],
    &'static [&'static str],
);

const COMPILES: &[Row] = &[
    (
        "import d, { a, b as c } from \"x\";\nconsole.log(d, a, c);\n",
        "default-and-named.ts",
        &["x"],
        &[
            "const __m0 = __import(\"x\");",
            "const d = __m0.default;",
            "const { a, b: c } = __m0;",
        ],
    ),
    (
        "import * as n from \"x\";\nimport \"y\";\nimport type { T } from \"z\";\nconst t: T = n;\n",
        "namespace-and-bare.ts",
        &["x", "y"],
        &["const n = __import(\"x\");", "__import(\"y\");"],
    ),
    (
        "export const answer: number = 42;\nexport function f() {}\nexport class C {}\n",
        "declarations.ts",
        &[],
        &[
            "Object.defineProperty(__exports, \"answer\", { enumerable: true, get: () => answer });",
            "Object.defineProperty(__exports, \"f\", { enumerable: true, get: () => f });",
            "Object.defineProperty(__exports, \"C\", { enumerable: true, get: () => C });",
            "const answer = 42;",
            "function f() {}",
        ],
    ),
    (
        "const a = 1;\nexport { a as b };\nexport default { a };\n",
        "named-and-default.ts",
        &[],
        &[
            "Object.defineProperty(__exports, \"b\", { enumerable: true, get: () => a });",
            "__exports.default = ",
        ],
    ),
    (
        "export { a, b as c } from \"x\";\nexport * from \"y\";\nexport * as z from \"z\";\n",
        "re-exports.ts",
        &["x", "y", "z"],
        &[
            "get: () => __m0.a",
            "Object.defineProperty(__exports, \"c\", { enumerable: true, get: () => __m0.b });",
            "for (const __k of Object.keys(__m1))",
            "Object.defineProperty(__exports, \"z\", { enumerable: true, get: () => __m2 });",
        ],
    ),
    (
        "import { useState } from \"react\";\nexport default function Page() {\n  const [n] = useState(0);\n  return <p>{n}</p>;\n}\n",
        "page.tsx",
        &["react", "react/jsx-runtime"],
        &[
            "__import(\"react/jsx-runtime\")",
            "function Page()",
            "get: () => Page",
        ],
    ),
    (
        "export enum Size {\n  Small,\n  Large,\n}\n",
        "enum.ts",
        &[],
        &["Object.defineProperty(__exports, \"Size\", { enumerable: true, get: () => Size });"],
    ),
    (
        "export const f = async () => {\n  await Promise.resolve();\n};\n",
        "await-in-function.ts",
        &[],
        &["await Promise.resolve()"],
    ),
    (
        "const __m0 = 1;\nimport { a } from \"x\";\nexport { b } from \"y\";\nconsole.log(__m0, a);\n",
        "generated-names.ts",
        &["x", "y"],
        &[
            "const __m1 = __import(\"x\");",
            "const __m2 = __import(\"y\");",
            "const __m0 = 1;",
        ],
    ),
];
#[test]
fn compiles() {
    for (source, filename, imports, fragments) in COMPILES {
        let compiled = compile(source, filename)
            .unwrap_or_else(|error| panic!("{filename}: {}", error.message));
        assert!(
            !has_module_statement(&compiled.code),
            "{filename}: a module statement is left in\n{}",
            compiled.code
        );
        assert_eq!(&compiled.imports, imports, "{filename}: imports");
        for fragment in *fragments {
            assert!(
                compiled.code.contains(fragment),
                "{filename}: no `{fragment}` in\n{}",
                compiled.code
            );
        }
    }
}

#[test]
fn strict_mode_then_getters_come_first() {
    let compiled = compile("console.log(1);\nexport const x = 1;\n", "first.ts").unwrap();
    assert!(
        compiled
            .code
            .starts_with("\"use strict\";\nObject.defineProperty(__exports, \"x\""),
        "{}",
        compiled.code
    );
    let directive = compile("\"use client\";\nexport const x = 1;\n", "kept.ts").unwrap();
    assert!(
        directive
            .code
            .starts_with("\"use strict\";\n\"use client\";\nObject.defineProperty"),
        "{}",
        directive.code
    );
}

#[test]
fn refuses() {
    // Source, file name, line, column, and the start of the message.
    let rows: &[(&str, &str, u32, u32, &str)] = &[
        (
            "const a = 1;\nconst b = 2;\nconst c = ;\n",
            "syntax.ts",
            3,
            11,
            "Unexpected token",
        ),
        (
            "const a = 1;\nconst data = await fetch(\"x\");\n",
            "await.ts",
            2,
            14,
            "top-level await is not supported: load in the function you export",
        ),
        (
            "for await (const x of xs) {}\n",
            "for-await.ts",
            1,
            1,
            "top-level await is not supported: load in the function you export",
        ),
        (
            "export function f() {\n  return import(\"x\");\n}\n",
            "dynamic.ts",
            2,
            10,
            "dynamic import is not supported",
        ),
        (
            "\nconst url = import.meta.url;\n",
            "meta.ts",
            2,
            13,
            "import.meta is not supported",
        ),
        (
            "export default 1;\nexport default 2;\n",
            "two-defaults.ts",
            2,
            8,
            "default is exported twice",
        ),
        (
            "const a = 1;\nexport { a };\nexport { a };\n",
            "two-names.ts",
            3,
            10,
            "a is exported twice",
        ),
        (
            "\nimport x = require(\"y\");\n",
            "import-equals.ts",
            2,
            1,
            "import = require is not supported: use import x from \"y\"",
        ),
        (
            "const x = 1;\nexport = x;\n",
            "export-assignment.ts",
            2,
            1,
            "export = is not supported: use export default",
        ),
        (
            "export const a = 1;\n",
            "page.js",
            1,
            1,
            "page.js is not a TypeScript file",
        ),
        (
            "export const a = 1;\n",
            "page.jsx",
            1,
            1,
            "page.jsx is not a TypeScript file",
        ),
        (
            "export const a = 1;\n",
            "types.d.ts",
            1,
            1,
            "types.d.ts is not a TypeScript file",
        ),
    ];
    for (source, filename, line, column, message) in rows {
        let CompileError {
            line: got_line,
            column: got_column,
            message: got_message,
        } = compile(source, filename).expect_err(filename);
        assert!(
            got_message.starts_with(message),
            "{filename}: {got_message}"
        );
        assert_eq!((got_line, got_column), (*line, *column), "{filename}");
    }
}

#[test]
fn overloads_and_merged_types_are_not_duplicates() {
    let source = "export function f(a: string): void;\nexport function f(a: number): void;\nexport function f(a: unknown) {}\nexport interface T {}\nexport type T2 = T;\n";
    compile(source, "overloads.ts").unwrap_or_else(|error| panic!("{}", error.message));
}
