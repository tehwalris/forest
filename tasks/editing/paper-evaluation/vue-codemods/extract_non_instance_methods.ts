export default {
  name: "Component",
  methods: {
    close() {
      this.$emit("close");
    },
    noThis() {
      return "I should be extracted to the global space";
    },
    noThisButUsedInTemplate1() {
      return "I should stay in the instance";
    },
    noThisButUsedInTemplate2() {
      return "I should stay in the instance";
    },
  },
};
