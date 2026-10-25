# HookOn cheat sheet

HookOn is a 256-bit mask encoded as exactly 64 hex characters. For ordinary transaction IDs a zero bit enables execution; a one bit disables it. **SetHook, type 22, is the exception: its bit is active-high.** Consequently all-zero is not “disabled”; it enables ordinary types while leaving SetHook off. The all-disabled baseline is all ones with bit 22 cleared.

Use the helper instead of manually subtracting numbers:

```sh
node scripts/hookon.mjs --types Payment,Invoke
node scripts/hookon.mjs --types none
node scripts/hookon.mjs --incoming Payment --outgoing Invoke
node scripts/hookon.mjs --incoming Invoke --outgoing none
```

Output includes the fields to copy into the Hook object and a table-like JSON list of selected names, IDs and directions. A small reviewed map supports common examples. For another named type, save the node's `server_definitions` response and use `--definitions definitions.json`, or supply an independently verified numeric ID in 0..255. The helper is offline: it cannot determine amendment activation.

### Directional fields

The current [HookOnV2_1 amendment](https://xahau.network/docs/features/amendments/#hookonv2_1) supersedes HookOnV2. Supply both directional fields, never combine them with HookOn, and use HookOn when both masks would be equal. Incoming means another initiating account; outgoing means the hook account initiates. It does not mean every hook becomes a transactional stakeholder.

Confirm both node amendment support and transaction serializer support. This package's optional signer uses `xahau@4.2.0` but intentionally accepts legacy HookOn only; it is not a directional deployment example. Do not infer a universal minimum library version from a blog post.

Activation on SetHook requires an explicit `--allow-sethook` when calculating a mask; the beginner signer refuses it. This avoids accidentally making future repairs subject to a broken hook. Advanced projects may require it, with a reviewed recovery design.

The helper is for activation fields, not for synthesizing all possible emission/authorization policies. See the primary [HookOn documentation](https://xahau.network/docs/hooks/concepts/hookon-field/) and verify against pinned node definitions.
