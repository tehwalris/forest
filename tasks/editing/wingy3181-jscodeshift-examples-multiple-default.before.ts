function defaultFunctionName() {
  ab();
  cd();
}

function e() {
  ba();
  dc();
  $("selector").val("newValue");
  if (true) $("selector2").val("newValue2");
  if (true) {
    $("selector3").val("newValue3");
    $("selector4").val("newValue4");
  }
  $("selector").val();
  $("selector").val(var1);
  if (true) $("selector2").val(var2);
  if (true) {
    $("selector3").val(var3);
    $("selector4").val(var4);
  }
}
