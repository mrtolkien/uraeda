A code repository is available in the `/app` directory. Your task is to implement the changes
necessary to satisfy the following Pull Request (PR) description:

<pr_description>

## Title: Kernel vulnerability detection can include inactive kernels

### Description

Currently, kernel vulnerability scans can include installed kernel packages that do not match the
running kernel, leading to inaccurate vulnerability and fix status results.

## Requirements

- Kernel source package handling must recognize Debian and Ubuntu kernel source packages, including
  `linux`, versioned kernel packages, `linux-grsec`, `linux-aws`, `linux-aws-edge`,
  `linux-aws-5.15`, `linux-lowlatency-hwe-5.15`, and `linux-realtime`, and must not treat normal
  packages such as `apt` and `linux-base` as kernel sources.

- Kernel source package names must be normalized per distribution family where needed for
  vulnerability lookup, including treating Debian `linux-signed` as `linux` and Ubuntu `linux-meta`
  as `linux`, while unrelated package names must be left unchanged.

- When multiple kernel versions are installed on Debian- or Ubuntu-based systems, the
  installed-package parsing routine itself must retain only kernel source-package groups tied to the
  running kernel release, and must return already-filtered installed-package and source-package maps
  directly from that parsing step, with no separate post-processing pass on already-scanned results.

- A kernel source-package group whose binaries do not include a running-kernel image or headers
  package (Debian: linux-image-<Release>, linux-headers-<Release>; Ubuntu:
  linux-image[-unsigned|-uc|...]-<Release>, linux-signed-image-<Release>, linux-headers-<Release>,
  linux-modules[-extra|-nvidia|...]-<Release>, linux-tools-<Release>, linux-buildinfo-<Release>,
  linux-cloud-tools-<Release>, linux-lib-rust-<Release>, and the
  linux-{modules,objects,signatures}-nvidia-*-<Release> variants) must be dropped, and its binary
  entries must not appear in the returned installed-package map.

- Debian kernel package collection must keep the running kernel image, matching headers, and related
  binaries from the same retained kernel source version, while preserving non kernel packages
  normally.

- Ubuntu kernel package collection must keep only image, header, module, and related kernel binaries
  tied to the running kernel release, and must exclude binaries from other installed kernel
  releases.

- Ubuntu fixed vulnerability detection must report affected binary packages attached to the affected
  source package, instead of limiting kernel results to a single running image binary.

- Because kernel scoping is applied during installed-package parsing (bullet above), the Ubuntu
  vulnerability-detection helper that walks a source package's CVE patches and emits affected binary
  statuses must operate purely on the retained source-package input (source-package name, version,
  and binary-name list) plus the CVE map and the fixed/unfixed flag; it must NOT accept an
  additional running-kernel-binary-name argument, and it must emit fix statuses for every retained
  binary of the affected source package rather than gating each binary on a running-kernel match.

- Ubuntu kernel meta package detection must use the recorded source package version and the advisory
  fixed version directly, so meta packages are not reported as affected through rewritten kernel
  version comparisons.

- Non kernel package detection and reporting must remain unchanged while the kernel specific
  filtering and reporting rules are applied.

- `parseInstalledPackages` (and the helpers it calls on the new Debian/Ubuntu path) must not emit
  log output: the scanner may be constructed without a logger, so any logging call there would
  dereference nil and panic. Keep the new path log-free (log from callers instead). Retention is per
  source-package group; unflavored binaries such as `linux-headers-5.15.0-69` are kept.

- `IsKernelSourcePackage(family, name)` must first normalize `name` with
  `RenameKernelSourcePackageName` and then match the normalized name against `linux`,
  `linux-<version>` (e.g. `linux-5.15`) and `linux-<flavor>[-edge|-<version>]`; so Ubuntu
  `linux-meta`, `linux-signed`, `linux-meta-realtime` and Debian `linux-signed-amd64` are all kernel
  sources.

- `RenameKernelSourcePackageName` must, for Debian, map `linux-signed` to `linux` and also map
  architecture-suffixed signed names such as `linux-signed-amd64` to `linux`; for Ubuntu, replace a
  leading `linux-meta`/`linux-signed` with `linux` (`linux-meta` -> `linux`, `linux-meta-realtime`
  -> `linux-realtime`).

- A kernel source-package group is the pair (source name as recorded, source version). Decide
  retention per group: drop it unless one of its binaries is a running-kernel image/headers (or
  Ubuntu variant) package for the running release; then merge the retained groups into the
  source-package map keyed by the unrenamed source name (`linux-signed-amd64` stays
  `linux-signed-amd64`; renaming applies only during vulnerability lookup). Two `linux` groups with
  different versions are evaluated independently.

- In the Ubuntu detection helper declare the result slice as `var contents []cveContent` so a source
  with no affected CVEs yields `nil` rather than an empty slice, and set `FixedIn` to the advisory
  note value verbatim.

## New Interfaces

- Path: `models/packages.go`
- Name: `models.RenameKernelSourcePackageName`
- Type: function
- Input: family string, name string
- Output: string
- Description: Normalizes a kernel source package name for the given distribution family, mapping
  Debian `linux-signed` to `linux` and Ubuntu `linux-meta` to `linux`, and returning the original
  name for unrecognized families.

- Path: `models/packages.go`
- Name: `models.IsKernelSourcePackage`
- Type: function
- Input: family string, name string
- Output: bool
- Description: Determines if a package name represents a kernel source package based on naming
  patterns and distribution family. Handles Debian, Raspbian, and Ubuntu with support for various
  kernel variants (aws, azure, hwe, oem, raspi, lowlatency, realtime, etc.) and version patterns.
  </pr_description>

Constraints:

- Do not reference, look up, or copy existing solutions, external PRs, or online workarounds. The
  implementation must be entirely your own independent work.
