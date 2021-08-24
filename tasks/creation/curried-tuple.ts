var makeTuple: <A>(v: A) => <B>(v: B) => [A, B];

export const test = makeTuple<number>(123)<string>("abc");
