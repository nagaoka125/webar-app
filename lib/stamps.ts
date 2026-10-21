export type Stamp = {
  id: string;
  name: string;
  image: string;
  description: string;
};

export const STAMPS: Stamp[] = [
  {
    id: "stamp-01",
    name: "スタンプ 1",
    image: "/assets/stamps/stamp-01.png",
    description: "最初に見つけた記念スタンプ",
  },
  {
    id: "stamp-02",
    name: "スタンプ 2",
    image: "/assets/stamps/stamp-02.png",
    description: "2つ目の記念スタンプ",
  },
  {
    id: "stamp-03",
    name: "スタンプ 3",
    image: "/assets/stamps/stamp-03.png",
    description: "3つ目の記念スタンプ",
  },
];

export const STAMP_STORAGE_KEY = "webar-owned-stamps";
