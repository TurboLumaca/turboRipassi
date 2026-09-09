/**
 * Manual mock for Jest — Node module mocks in the root `__mocks__/` are
 * picked up automatically, no `jest.mock()` call needed.
 *
 * The real `MarkdownTextInput` creates a native JSI worklet runtime
 * (`createWorkletRuntime`) on mount, and `react-native-worklets` refuses to
 * do that outside a real native/Hermes environment — it throws "not
 * supported on web", which is what Jest's Node test environment resolves
 * as. A plain multiline `TextInput` exercises every prop this app actually
 * reads (`value`, `onChangeText`, `placeholder`, `multiline`, `style`)
 * without touching that runtime; live markdown highlighting is a rendering
 * detail no unit test asserts on.
 */
const React = require("react");
const { TextInput } = require("react-native");

const MarkdownTextInput = React.forwardRef((props, ref) => {
  // eslint-disable-next-line no-unused-vars
  const { parser, markdownStyle, ...campiTestInput } = props;
  return React.createElement(TextInput, { ...campiTestInput, ref });
});
MarkdownTextInput.displayName = "MarkdownTextInput";

module.exports = {
  MarkdownTextInput,
  parseExpensiMark: () => [],
};
