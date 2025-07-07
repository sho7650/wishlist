export interface WishProps {
  id?: string;
  name?: string;
  wish: string;
  createdAt?: Date | string; // 文字列も受け付ける
}

export class Wish {
  readonly id: string;
  readonly name?: string;
  readonly wish: string;
  readonly createdAt: Date;

  constructor(props: WishProps) {
    this.id = props.id || crypto.randomUUID();
    this.name = props.name;
    this.wish = props.wish;

    // createdAtが文字列なら日付オブジェクトに変換
    if (typeof props.createdAt === "string") {
      this.createdAt = new Date(props.createdAt);
    } else {
      this.createdAt = props.createdAt || new Date();
    }
  }

  update(name?: string, wish?: string): Wish {
    return new Wish({
      id: this.id,
      name: name || this.name,
      wish: wish || this.wish,
      createdAt: this.createdAt,
    });
  }
}
