<TouchableBounce onPress={function() {}}>
  <View style={{color: 'red'}} />
</TouchableBounce>;

<View>
  <TouchableBounce>
    <View style={{color: 'red'}}>
      <Image />
      <Image />
    </View>
  </TouchableBounce>
</View>;

<TouchableBounce>
  <CustomView style={{color: 'red'}}>
    <Image />
  </CustomView>
</TouchableBounce>;

<TouchableBounce>
  <View>1</View>
  <View>2</View>
</TouchableBounce>;

<TouchableOpacity onPress={function() {}}>
  <View style={{color: 'red'}} />
</TouchableOpacity>;

<TouchableHighlight onPress={function() {}}>
  <View style={{color: 'red'}} />
</TouchableHighlight>;
