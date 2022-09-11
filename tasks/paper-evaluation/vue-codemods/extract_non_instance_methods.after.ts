const noThis = function () {
  return "I should be extracted to the global space";
};
export default {
  name: "Component",
  methods: {
    close() {
      this.$emit("close");
    },
    noThisButUsedInTemplate1() {
      return "I should stay in the instance";
    },
    noThisButUsedInTemplate2() {
      return "I should stay in the instance";
    },
  },
};
