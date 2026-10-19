A code repository is available in the `/app` directory. Your task is to implement the changes
necessary to satisfy the following Pull Request (PR) description:

<pr_description>

## Title: BIG-IP message routing routes cannot be managed from Ansible

### Description

Ansible has no module for managing message routing routes on F5 BIG-IP devices: there is no
`network.f5.bigip_message_routing_route`. A playbook cannot express a generic message routing route
as desired state, so creating a route, changing the settings of one that already exists, and
removing one that is no longer needed all have to be done by hand through the BIG-IP user interface
or through custom REST scripts. Those steps are error prone and are not idempotent, so a play that
runs twice cannot be relied on to leave the device in the state it describes.

## Requirements

- A new Ansible module named `bigip_message_routing_route` must exist and be available for use.

- The module must accept the parameters `name` (string, required), `description` (string, optional),
  `src_address` (string, optional), `dst_address` (string, optional), `peer_selection_mode` (string,
  choices: `ratio`, `sequential`, optional), `peers` (list of strings, optional), `partition`
  (string, defaults to `"Common"`), and `state` (string, choices: `present`, `absent`, default
  `"present"`).

- The `peers` parameter must be exposed using fully qualified names in the form
  `/<partition>/<peer name>`, incorporating the configured `partition`; a peer value that already
  begins with `/` must be preserved unchanged (for example, with `partition` `foobar`,
  `["plain_peer", "/Common/qualified_peer"]` is exposed as
  `["/foobar/plain_peer", "/Common/qualified_peer"]`).

- Parameter handling must expose values for `name`, `partition`, `description`, `src_address`,
  `dst_address`, `peer_selection_mode`, and `peers`.

- Constructing parameter objects from module input and from API-shaped data must be supported via
  `ModuleParameters` and `ApiParameters`, with consistent field mappings: values read from the
  device use the field names `sourceAddress`, `destinationAddress` and `peerSelectionMode`, which
  must be exposed as `src_address`, `dst_address` and `peer_selection_mode` respectively, while
  `name`, `partition`, `description` and `peers` keep their names; the same device field names must
  be used when sending values to the device.

- Comparison logic must detect differences for `description`, `src_address`, `dst_address`,
  `peer_selection_mode`, and `peers` between desired and current configurations; a route whose
  current `peer_selection_mode` differs from the requested one must be treated as needing an update,
  and the requested value must appear in the result.

- When executed with `state="present"` and the route does not exist, the result must indicate
  `changed=True` and include the provided parameter values.

- When executed with `state="present"` and the route exists but differs in one or more parameters,
  the result must indicate `changed=True` and include the updated values.

- When executed with `state="absent"` and the route exists, the route must be removed from the
  device and the result must indicate `changed=True`.

- The module result dictionary must include `description`, `src_address`, `dst_address`,
  `peer_selection_mode`, and `peers` only for values that were provided or changed, and must omit
  those keys otherwise; for example, a removal that supplies no such values produces no
  `description` key.

- Path: `lib/ansible/modules/network/f5/bigip_message_routing_route.py`

- Name: `bigip_message_routing_route`

- Type: file

- Input: N/A

- Output: N/A

- Description: New Ansible module for managing BIG-IP message routing generic routes with create,
  update, and delete operations.

- Name: `bigip_message_routing_route.Parameters`

- Type: class

- Input: params: dict

- Description: Base parameter container defining API field mappings and returnable/updatable
  attribute sets.

- Name: `bigip_message_routing_route.ApiParameters`

- Description: Parameter view over device API responses for BIG-IP message routing routes.

- Name: `bigip_message_routing_route.ModuleParameters`

- Description: Parameter view over module input that transforms peers to fully qualified names.

- Name: `bigip_message_routing_route.Changes`

- Description: Tracks effective changes and renders values to return from module execution.

- Name: `bigip_message_routing_route.UsableChanges`

- Description: Concrete change set used by managers during create and update operations.

- Name: `bigip_message_routing_route.ReportableChanges`

- Description: Change view for values reported in the module result.

- Name: `bigip_message_routing_route.Difference`

- Input: want: Parameters, have: Parameters = None

- Description: Compares desired vs current state for specific fields like description, addresses,
  and peers.

- Name: `bigip_message_routing_route.BaseManager`

- Input: module: AnsibleModule, kwargs: dict

- Description: Shared CRUD flow including present/absent routing, idempotency checks, and result
  assembly.

- Name: `bigip_message_routing_route.GenericModuleManager`

- Description: Implements HTTP calls to BIG-IP for generic message-routing routes operations.

- Name: `bigip_message_routing_route.ModuleManager`

- Description: Top-level dispatcher that validates context and selects the appropriate manager.

- Name: `bigip_message_routing_route.ArgumentSpec`

- Description: Declares the Ansible argument schema including options, defaults, and choices.

- Name: `bigip_message_routing_route.main`

- Type: function

- Description: Module entry point that builds the argument specification, instantiates the module,
  runs the manager, and exits with the result or fails with the error message.

## New Interfaces

- Path: `lib/ansible/modules/network/f5/bigip_message_routing_route.py`
- Name: `bigip_message_routing_route`
- Type: file
- Input: N/A
- Output: N/A
- Description: New Ansible module for managing BIG-IP message routing generic routes with create,
  update, and delete operations.

- Path: `lib/ansible/modules/network/f5/bigip_message_routing_route.py`
- Name: `bigip_message_routing_route.Parameters`
- Type: class
- Input: params: dict
- Output: N/A
- Description: Base parameter container defining API field mappings and returnable/updatable
  attribute sets.

- Path: `lib/ansible/modules/network/f5/bigip_message_routing_route.py`
- Name: `bigip_message_routing_route.ApiParameters`
- Type: class
- Input: params: dict
- Output: N/A
- Description: Parameter view over device API responses for BIG-IP message routing routes.

- Path: `lib/ansible/modules/network/f5/bigip_message_routing_route.py`
- Name: `bigip_message_routing_route.ModuleParameters`
- Type: class
- Input: params: dict
- Output: N/A
- Description: Parameter view over module input that transforms peers to fully qualified names.

- Path: `lib/ansible/modules/network/f5/bigip_message_routing_route.py`
- Name: `bigip_message_routing_route.Changes`
- Type: class
- Input: params: dict
- Output: N/A
- Description: Tracks effective changes and renders values to return from module execution.

- Path: `lib/ansible/modules/network/f5/bigip_message_routing_route.py`
- Name: `bigip_message_routing_route.UsableChanges`
- Type: class
- Input: params: dict
- Output: N/A
- Description: Concrete change set used by managers during create and update operations.

- Path: `lib/ansible/modules/network/f5/bigip_message_routing_route.py`
- Name: `bigip_message_routing_route.ReportableChanges`
- Type: class
- Input: params: dict
- Output: N/A
- Description: Change view for values reported in the module result.

- Path: `lib/ansible/modules/network/f5/bigip_message_routing_route.py`
- Name: `bigip_message_routing_route.Difference`
- Type: class
- Input: want: Parameters, have: Parameters = None
- Output: N/A
- Description: Compares desired vs current state for specific fields like description, addresses,
  and peers.

- Path: `lib/ansible/modules/network/f5/bigip_message_routing_route.py`
- Name: `bigip_message_routing_route.BaseManager`
- Type: class
- Input: module: AnsibleModule, kwargs: dict
- Output: N/A
- Description: Shared CRUD flow including present/absent routing, idempotency checks, and result
  assembly.

- Path: `lib/ansible/modules/network/f5/bigip_message_routing_route.py`
- Name: `bigip_message_routing_route.GenericModuleManager`
- Type: class
- Input: module: AnsibleModule, kwargs: dict
- Output: N/A
- Description: Implements HTTP calls to BIG-IP for generic message-routing routes operations.

- Path: `lib/ansible/modules/network/f5/bigip_message_routing_route.py`
- Name: `bigip_message_routing_route.ModuleManager`
- Type: class
- Input: module: AnsibleModule, kwargs: dict
- Output: N/A
- Description: Top-level dispatcher that validates context and selects the appropriate manager.

- Path: `lib/ansible/modules/network/f5/bigip_message_routing_route.py`
- Name: `bigip_message_routing_route.ArgumentSpec`
- Type: class
- Input: N/A
- Output: N/A
- Description: Declares the Ansible argument schema including options, defaults, and choices.

- Path: `lib/ansible/modules/network/f5/bigip_message_routing_route.py`
- Name: `bigip_message_routing_route.main`
- Type: function
- Input: N/A
- Output: N/A
- Description: Module entry point that builds the argument specification, instantiates the module,
  runs the manager, and exits with the result or fails with the error message. </pr_description>

Constraints:

- Do not reference, look up, or copy existing solutions, external PRs, or online workarounds. The
  implementation must be entirely your own independent work.
