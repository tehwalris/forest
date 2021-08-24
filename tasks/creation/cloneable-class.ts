class Cloneable {
  constructor(
    private a: string,
    private b: number,
    private c: number[],
    private d: string,
  ) {}

  clone(): Cloneable {
    return new Cloneable(this.a, this.b, this.c, this.d);
  }
}
