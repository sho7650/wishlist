export interface WishProps {
  id?: string;
  userId?: number; // ユーザーIDを追加
  name?: string;
  wish: string;
  createdAt?: Date | string; // 文字列も受け付ける
  supportCount?: number; // 応援数を追加
}

export class Wish {
  public static readonly MAX_NAME_LENGTH = 64;
  public static readonly MIN_WISH_LENGTH = 1;
  public static readonly MAX_WISH_LENGTH = 240;

  readonly id: string;
  readonly userId?: number; // ユーザーIDを追加
  readonly name?: string;
  readonly wish: string;
  readonly createdAt: Date;
  readonly supportCount: number; // 応援数を追加

  constructor(props: WishProps) {
    // 👇 --- バリデーションを追加 ---
    if (props.name && props.name.length > Wish.MAX_NAME_LENGTH) {
      throw new Error(
        `Name cannot be longer than ${Wish.MAX_NAME_LENGTH} characters.`
      );
    }
    if (props.wish.length < Wish.MIN_WISH_LENGTH) {
      throw new Error(
        `Wish must have at least ${Wish.MIN_WISH_LENGTH} character.`
      );
    }
    if (props.wish.length > Wish.MAX_WISH_LENGTH) {
      throw new Error(
        `Wish cannot be longer than ${Wish.MAX_WISH_LENGTH} characters.`
      );
    }
    this.id = props.id || crypto.randomUUID();
    this.name = props.name;
    this.wish = props.wish;
    this.userId = props.userId;
    this.supportCount = props.supportCount || 0;

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
      userId: this.userId,
      // name は undefined の場合のみ元の値を採用
      name: name !== undefined ? name : this.name,
      // wish も undefined の場合のみ元の値を採用
      // これにより、空文字 "" はそのままコンストラクタに渡される
      wish: wish !== undefined ? wish : this.wish,
      createdAt: this.createdAt,
      supportCount: this.supportCount,
    });
  }
}
