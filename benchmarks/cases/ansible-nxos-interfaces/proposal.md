A code repository is available in the `/app` directory. Your task is to implement the changes
necessary to satisfy the following Pull Request (PR) description:

<pr_description>

# Title: `nxos_interfaces` does not handle enabled/shutdown correctly with device defaults

## Description

The `nxos_interfaces` module does not manage the enabled parameter in a way that matches the default
shutdown state on NX-OS devices. The module can send shutdown or no shutdown commands when the
interface is already at its default enabled state, which breaks idempotence. The default enabled
state depends on device settings such as system default switchport and on the interface type and
layer mode (L2/L3), and it differs between platform families. The module ignores those defaults, so
it emits the wrong shutdown behavior in the merged, deleted, replaced and overridden states and
reports a change when the desired state already matches the device default.

## Requirements

- The `nxos_interfaces` resource module must manage interface configuration on NX-OS devices,
  supporting `merged`, `replaced`, `overridden`, and `deleted` states.

- The module must not define a default value for `enabled` in the argument spec or module
  documentation.

- When `enabled` is omitted from the play, the module must not generate `shutdown` or `no shutdown`.

- When `enabled` is explicitly set to `false` and the computed or current default/admin state of the
  interface is enabled, the module must generate `shutdown`.

- When `enabled` is explicitly set to `true` and the computed or current default/admin state of the
  interface is disabled, the module must generate `no shutdown`.

- The baseline the desired `enabled` is compared against must be the interface's current admin state
  when its running-config section carries an explicit `shutdown` or `no shutdown`, and otherwise the
  default computed for the mode the interface will have after the change; when the mode is being
  reset in `replaced`, `overridden` or `deleted`, that mode is the device-wide default mode.

- In `deleted` state, the desired `enabled` must be that computed default.

- When gathering facts, the module must issue two separate device queries:
  `show running-config all | incl 'system default switchport'` and
  `show running-config | section ^interface`.

- The facts connection returned by `get_resource_connection` must be treated as a mapping from exact
  command string to command output: each device output must be obtained by looking up the full,
  exact command string as a single key, one lookup per command.

- The config side's `get_resource_connection` may return `None`, so the config side must issue no
  device queries of its own.

- The module must parse `system default switchport` and `system default switchport shutdown` from
  the first query; these two settings, together with platform family and the interface's mode,
  determine that interface's default enabled state.

- `system default switchport` must set the device-wide default interface mode to layer2, and
  `no system default switchport` must set it to layer3.

- When an interface's running-config section carries neither `switchport` nor `no switchport`, the
  module must treat that interface as being in the device-wide default interface mode, and that mode
  must decide whether a switchport command is emitted for the interface at all.

- Loopback and port-channel interfaces must default to administratively enabled.- L2 Ethernet
  defaults must follow `system default switchport shutdown` /
  `no system default switchport shutdown`.

- L3 Ethernet defaults must be enabled on N3K/N5K/N6K-family platforms and disabled on
  N7K/N9K-family platforms.

- Platform family must be read through a private helper method named `_device_info` on
  `InterfacesFacts`, whose returned mapping exposes it under the `network_os_platform` entry.

- The platform family must be determined from the leading `N3K`/`N5K`/`N6K`/`N7K`/`N9K` prefix of
  the `network_os_platform` value.

- Interfaces that exist on the device with only default configuration must be tracked separately
  from gathered interfaces with non-default attributes, and must be treated as existing for
  idempotence and virtual-interface handling.

- Each gathered interface fact dict must contain only keys declared in the argument spec.

- Reserved interfaces such as `mgmt0` must be excluded from module management.

- The module must parse running-config interface sections for `description`, `speed`, `duplex`,
  `mtu`, `mode` (layer2/layer3), `enabled`, `ip_forward`, and `fabric_forwarding_anycast_gateway`.

- When `ip forward` or `fabric forwarding mode anycast-gateway` is present in an interface section,
  the module must treat that attribute as `True`; when the command is absent from the section, the
  module must leave that attribute unset.

- For each interface, `switchport` / `no switchport` must appear before `shutdown` / `no shutdown`
  and before other attribute commands, and `layer2` must generate `switchport` while `layer3` must
  generate `no switchport`.

- In `merged`, `replaced`, and `overridden` states, when an interface named in the play does not
  exist on the device, the module must create it by emitting a bare `interface <name>` line with no
  sub-command, even when no attribute changes.

- In `deleted` state, when an interface named in the play does not exist on the device, the module
  must emit no command line for that interface.

- When an interface named in the play already exists on the device and no attribute changes, the
  module must emit no line at all for that interface.

- When an interface has changed attributes, the module must emit `interface <name>` followed by a
  sub-command for each changed attribute.

- The `interface <name>` header must be emitted exactly once per interface per run, even when both
  reset commands and set commands apply to that interface.

- In `deleted` state, the module must restore specified interfaces to defaults by issuing
  `no <attribute>` commands and any mode or enabled resets needed to return each attribute to its
  computed default.

- When `state` is `deleted` and no `config` is provided, the module must reset all managed existing
  interfaces to defaults.

- In `replaced` state, each interface listed in the play must receive the requested configuration,
  and unspecified non-default attributes must be removed only when that interface already exists on
  the device.

- In `replaced` state, interfaces that are new or default-only must receive only the attributes
  specified in the play.

- In `overridden` state, interfaces listed in the play must behave like `replaced`, and managed
  existing interfaces not listed in the play must also be reset to defaults.

- When the requested configuration already matches the device state, including implicit defaults for
  omitted `enabled` and default-only interfaces, the module must return `changed: false` and an
  empty `commands` list.

- Device configuration must be applied through the public `edit_config(commands)` wrapper on
  `Interfaces`, not by calling the private connection object directly.

- Loopback and port-channel interfaces must default to administratively enabled.

- L2 Ethernet defaults must follow `system default switchport shutdown` /
  `no system default switchport shutdown`.

- To decide whether `shutdown`/`no shutdown` is emitted, compare the desired `enabled` against the
  interface's current admin state when its running-config section carries an explicit `shutdown` or
  `no shutdown`; otherwise compare it against the default computed for the mode the interface will
  have after this change (the device-wide default mode when the mode is being reset in `replaced`,
  `overridden` or `deleted`). In `deleted` state the desired `enabled` is that computed default.

- Emit the `interface <name>` header exactly once per interface per run, even when both reset
  commands and set commands apply to it.

- The facts connection returned by `get_resource_connection` behaves like a mapping from exact
  command string to command output: facts gathering must obtain each device output by looking up the
  full, exact command string (`show running-config all | incl 'system default switchport'` and
  `show running-config | section ^interface`) as a single key, one lookup per command. The config
  side's `get_resource_connection` may return `None`, so the config side must issue no device
  queries of its own and must apply changes only through `Interfaces.edit_config`.

- `network_os_platform` values look like `N9K-C93180YC-EX`; determine the platform family from the
  leading `N3K`/`N5K`/`N6K`/`N7K`/`N9K` prefix.

- Each gathered interface fact dict must contain only keys declared in the argument spec; track
  default-only interfaces outside the gathered facts list.

## New Interfaces

- Path: `lib/ansible/module_utils/network/nxos/config/interfaces/interfaces.py`

- Name: `Interfaces.edit_config`

- Type: method

- Input: commands: list

- Output: Device edit-config result (implementation-dependent; may be None)

- Description: Public wrapper around the connection's `edit_config` that lets external callers apply
  configuration without accessing the private connection object.

- Path: `lib/ansible/module_utils/network/nxos/config/interfaces/interfaces.py`

- Name: `Interfaces.default_enabled`

- Type: method

- Input: want: dict = None, have: dict = None, action: str = ''

- Output: bool or None

- Description: Determines the correct default administrative state for an interface, considering
  interface/mode transitions and the device system defaults gathered from the running configuration.
  Returns the default enabled state based on interface name, mode transitions, and those system
  defaults.

- Path: `lib/ansible/module_utils/network/nxos/facts/interfaces/interfaces.py`

- Name: `InterfacesFacts.render_system_defaults`

- Type: method

- Input: config: str

- Output: NA

- Description: Parses the user system defaults (e.g. `system default switchport`,
  `system default switchport shutdown`) and the platform family, and records the resulting
  device-wide default interface mode and the default L2 and L3 enabled states for later use in
  interface default evaluation.

- Path: `lib/ansible/module_utils/network/nxos/nxos.py`

- Name: `default_intf_enabled`

- Type: function

- Input: name: str = '', sysdefs: dict = None, mode: str = None- Output: bool or None

- Description: Computes the default administrative enabled/shutdown state for an interface based on
  its name/type (loopback, port-channel, Ethernet), the device's user system defaults (USD), and the
  target mode. L3 interfaces default to shutdown except on N3K/N5K/N6K-family platforms, loopbacks
  and port-channels default to enabled, and L2 interfaces follow the system default switchport
  shutdown setting.

- Input: name: str = '', sysdefs: dict = None, mode: str = None </pr_description>

Constraints:

- Do not reference, look up, or copy existing solutions, external PRs, or online workarounds. The
  implementation must be entirely your own independent work.
