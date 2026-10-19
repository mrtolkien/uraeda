A code repository is available in the `/app` directory. Your task is to implement the changes
necessary to satisfy the following Pull Request (PR) description:

<pr_description>

# Title

Make tracing sampling ratio and context propagators configurable

## Description

Flipt's tracing setup is hard-coded: it always samples every trace and always uses a fixed W3C
TraceContext + Baggage propagator composition. Operators have no way to reduce trace volume by
sampling only a fraction of requests, nor to choose which trace-context propagation formats (for
example b3, jaeger, xray) are used. The tracing configuration block exposes no `samplingRatio` or
`propagators` settings, so a configuration that contains them is neither validated nor honored, and
the generated JSON configuration schema does not advertise them either.

In addition, the service-name and service-version attributes on the trace resource are produced
through an outdated OpenTelemetry semantic-conventions API.

## Requirements

- The tracing configuration must support a `samplingRatio` setting, held in a `SamplingRatio` field
  of type `float64`. When loading a configuration that omits it, the effective value must default to
  `1` (sample everything), and the loaded value must be carried through on the tracing
  configuration.

- Loading a configuration whose `samplingRatio` is less than 0 or greater than 1 must fail with an
  error whose message is exactly `sampling ratio should be a number between 0 and 1`, with no prefix
  added.

- The tracing configuration must support a `propagators` setting, held in a
  `Propagators []TracingPropagator` field. When loading a configuration that omits it, the effective
  value must default to exactly the list `tracecontext`, `baggage`, in that order.

- The configuration package must declare an exported, string-based named type `TracingPropagator`,
  so a name such as `tracecontext` is written directly as one of the elements of the `propagators`
  list, with exported constants named exactly `TracingPropagatorTraceContext` (for the value
  `tracecontext`) and `TracingPropagatorBaggage` (for the value `baggage`).

- The accepted propagator names are `tracecontext`, `baggage`, `b3`, `b3multi`, `jaeger`, `xray`,
  `ottrace`, and `none`. Loading a configuration containing any other propagator name must fail with
  an error whose message is exactly `invalid propagator option: <name>`, where `<name>` is the
  offending value, with no prefix added.

- The `propagators` list must also load from the environment variable `FLIPT_TRACING_PROPAGATORS`,
  written as a space-separated list of names, and is validated the same way as when it comes from a
  file.

- A configuration file that explicitly sets `samplingRatio` (for example to `0.5`) or that sets
  `propagators` (for example to `tracecontext` and `baggage`) must load successfully and reflect
  those values in the resulting tracing configuration.

- The tracer provider constructor `NewProvider` must take exactly three positional parameters in
  this order: a `context.Context`, the Flipt version string, and a `config.TracingConfig` value. It
  must sample traces using a trace-ID ratio sampler driven by that configuration's `SamplingRatio`,
  rather than always sampling. A `SamplingRatio` of `0` is valid and means no trace is sampled; the
  provider must not substitute the default of `1` for a zero value.

- The global OpenTelemetry text-map propagator must be constructed from the configured `propagators`
  list, instead of being fixed to TraceContext and Baggage, and the gRPC server setup must install
  it whether or not tracing is enabled. Each accepted name must select the standard OpenTelemetry
  propagator known by that name, where `b3` is the single-header B3 format and `b3multi` is the
  multi-header B3 format. New Go module dependencies for propagator implementations may be added as
  ordinary module requirements, without vendoring or replace directives.

- The generated JSON configuration schema must describe the new tracing `samplingRatio` (a number
  between 0 and 1, defaulting to 1) and `propagators` (an array whose items are constrained to the
  accepted propagator names, defaulting to `tracecontext` and `baggage`) so that schema validation
  of the documented configuration succeeds.

- The trace resource must produce its service-name and service-version attributes using the current
  OpenTelemetry semantic-conventions API (semconv v1.24.0), such that a resource built for a given
  service name and version exposes the corresponding service-name and service-version attribute
  key/value pairs.

- The configuration package's existing tracing sample `otlp.yml` must additionally set
  `samplingRatio` to `0.5` under its `tracing` block, and the same directory must gain two samples:
  `wrong_sampling_ratio.yml`, enabling tracing and setting `samplingRatio` to `1.1`, and
  `wrong_propagator.yml`, enabling tracing and setting `propagators` to the single entry
  `wrong_propagator`.

- The tracing configuration must support a `samplingRatio` setting expressed as a floating-point
  number. When loading a configuration that omits it, the effective value must default to `1`
  (sample everything), and the loaded value must be carried through on the tracing configuration.

- Loading a configuration whose `samplingRatio` is less than 0 or greater than 1 must fail with the
  error message `sampling ratio should be a number between 0 and 1`.

- The tracing configuration must support a `propagators` setting expressed as a list of propagator
  names. When loading a configuration that omits it, the effective value must default to exactly the
  list `tracecontext`, `baggage`, in that order.

- The list of propagator names must be typed: the configuration package must declare an exported,
  string-based named type `TracingPropagator`, and the `propagators` setting must be a list of that
  type, so a name such as `tracecontext` is written directly as one of its elements.

- The accepted propagator names are `tracecontext`, `baggage`, `b3`, `b3multi`, `jaeger`, `xray`,
  `ottrace`, and `none`. Loading a configuration containing any other propagator name must fail with
  the error message `invalid propagator option: <name>`, where `<name>` is the offending value (for
  example, `invalid propagator option: wrong_propagator`).

- The tracer provider constructor must accept the tracing configuration itself (a
  `config.TracingConfig` value) alongside the existing context and Flipt-version arguments, rather
  than only a sampling-ratio number, and must sample traces using a trace-ID ratio sampler driven by
  that configuration's `SamplingRatio`, rather than always sampling.

- The global OpenTelemetry text-map propagator must be constructed from the configured `propagators`
  list, instead of being fixed to TraceContext and Baggage.

- The `TracingPropagator` type must declare exported constants named exactly
  `TracingPropagatorTraceContext` (for the value `tracecontext`) and `TracingPropagatorBaggage` (for
  the value `baggage`), and the tracing configuration must expose a `SamplingRatio` field and a
  `Propagators []TracingPropagator` field.

- The repository must carry the configuration samples the loader is exercised against:
  `internal/config/testdata/tracing/wrong_sampling_ratio.yml`, enabling tracing and setting
  `samplingRatio` to `1.1`; `internal/config/testdata/tracing/wrong_propagator.yml`, enabling
  tracing and setting `propagators` to the single entry `wrong_propagator`; and
  `internal/config/testdata/tracing/otlp.yml`, which must additionally set `samplingRatio` to `0.5`
  under its `tracing` block.

- `NewProvider` must take exactly three positional parameters in this order: a `context.Context`,
  the Flipt version string, and a `config.TracingConfig` value (so
  `NewProvider(context.Background(), "test", config.TracingConfig{SamplingRatio: 0})` compiles). The
  `b3multi` propagator must be a genuine B3 multi-header propagator whose text-map fields are
  exactly `x-b3-traceid`, `x-b3-spanid`, `x-b3-sampled` and `x-b3-flags`. New Go module dependencies
  for propagator implementations may be added as ordinary module requirements (no vendoring or
  replace directives); the build environment downloads modules.

- `SamplingRatio` must be declared as `float64`.

- Tracing validation errors must be returned by `Load` unwrapped: the returned error's `Error()`
  must equal exactly `sampling ratio should be a number between 0 and 1` or
  `invalid propagator option: <name>`, with no prefix such as `tracing:`.

- A `samplingRatio` of `0` is valid and means no trace is sampled (root spans are non-recording);
  the provider must not substitute the default of `1` for a zero value.

- The gRPC server setup must install the propagator built from `cfg.Tracing.Propagators` as the
  global OpenTelemetry text-map propagator unconditionally, including when `tracing.enabled` is
  false and the rest of the config is zero-valued, so that `otel.GetTextMapPropagator().Fields()`
  afterwards reports exactly the configured propagators' fields: `tracecontext` plus `baggage` yield
  `traceparent`, `tracestate`, `baggage`; `b3multi` yields exactly the four fields `x-b3-traceid`,
  `x-b3-spanid`, `x-b3-sampled`, `x-b3-flags`; `jaeger` yields `uber-trace-id`.

- The `propagators` list must also load from the environment variable `FLIPT_TRACING_PROPAGATORS`,
  written as a space-separated list of names, through the existing string-to-slice decoding.

## New Interfaces

- Path: internal/config/tracing.go

- Name: TracingPropagator

- Type: type

- Input: NA

- Output: NA

- Description: String-based named type for a trace-context propagator name used in the tracing
  configuration's `propagators` list. Its accepted values are `tracecontext`, `baggage`, `b3`,
  `b3multi`, `jaeger`, `xray`, `ottrace` and `none`, exposed as exported constants such as
  `TracingPropagatorTraceContext` and `TracingPropagatorBaggage`.

No new interfaces are introduced. </pr_description>

Constraints:

- Do not reference, look up, or copy existing solutions, external PRs, or online workarounds. The
  implementation must be entirely your own independent work.
