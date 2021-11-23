function a() {
  $("selector").attr("value", "newValue");
  if (true) $("selector2").attr("value", "newValue2");
  if (true) {
    $("selector3").attr("value", "newValue3");
    $("selector4").attr("value", "newValue4");
  }
  $("selector").val();
  $("selector").attr("value", var1);
  if (true) $("selector2").attr("value", var2);
  if (true) {
    $("selector3").attr("value", var3);
    $("selector4").attr("value", var4);
  }
}
