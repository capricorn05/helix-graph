declare namespace JSX {
  interface Element {
    readonly $$typeof: symbol;
    readonly type: any;
    readonly key: string | null;
    readonly ref: any;
    readonly props: any;
    readonly _owner: any;
    readonly _store: any;
  }

  interface ElementClass {
    render(): any;
  }

  interface ElementAttributesProperty {
    props: any;
  }

  interface ElementChildrenAttribute {
    children: any;
  }

  interface IntrinsicElements {
    [elementName: string]: {
      [attr: string]: any;
      key?: string | null;
      ref?: any;
      children?: any;
    };
  }

  type LibraryManagedAttributes<C, P> = P;
}
