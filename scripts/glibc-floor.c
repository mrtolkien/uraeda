// The package's glibc floor, `scripts/package.sh`: the dev shell's glibc gave ten math functions of
// libm new symbol versions (2.43 and 2.44), which no distribution had yet, so a binary built
// there ran on none. The package links with `--wrap=<function>` for each, and these wrappers
// call the version every glibc on x86_64 has had since 2.2.5. The script fails when a symbol needs
// a glibc past its floor, naming it: one more line here takes it back.

#define OLD(name, type, params, args)                                  \
    __asm__(".symver old_" #name ", " #name "@GLIBC_2.2.5");           \
    extern type old_##name params;                                     \
    type __wrap_##name params { return old_##name args; }

OLD(cosh, double, (double x), (x))
OLD(sinh, double, (double x), (x))
OLD(coshf, float, (float x), (x))
OLD(sinhf, float, (float x), (x))
OLD(acoshf, float, (float x), (x))
OLD(asinf, float, (float x), (x))
OLD(acosf, float, (float x), (x))
OLD(atan2f, float, (float y, float x), (y, x))
