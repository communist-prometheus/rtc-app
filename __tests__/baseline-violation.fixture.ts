// Fixture intentionally using a non-baseline Web API.
// The compat linter self-test points eslint at THIS file alone and
// asserts a non-zero exit code. If the linter ever stops flagging
// navigator.bluetooth, the self-test will fail — our guardrail is
// broken.
//
// navigator.bluetooth is the Web Bluetooth API — Chrome-only, not
// supported in Firefox or Safari, never in Baseline. This is exactly
// the kind of feature the compat plugin must catch.

const probe = async () => {
  const bt = navigator.bluetooth
  if (!bt) return
  const device = await bt.requestDevice({
    acceptAllDevices: true,
  })
  return device
}

void probe()
