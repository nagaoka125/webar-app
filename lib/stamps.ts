export type Stamp = {
  id: string;
  name: string;
  image: string;
  description: string;
  stampId: string;
  label: string;
  targetSrc: string;
  modelSrc: string;
  latitude: number;
  longitude: number;
};

export const STAMPS: Stamp[] = [
  {
    id: "stamp-01",
    name: "スタンプ 1",
    image: "/assets/stamps/stamp-01.png",
    description: "最初に見つけた記念スタンプ",
    stampId: "stamp-01",
    label: "ターゲット 1",
    targetSrc: "/assets/targets/targets.mind",
    modelSrc: "/assets/models/model.glb",
    latitude: 35.000000, 
    longitude: 135.000000,
  },
  {
    id: "stamp-02",
    name: "スタンプ 2",
    image: "/assets/stamps/stamp-02.png",
    description: "2つ目の記念スタンプ",
    stampId: "stamp-02",
    label: "ターゲット 2",
    targetSrc: "/assets/targets/targets02.mind",
    modelSrc: "/assets/models/model02.glb",
    latitude: 35.000000, 
    longitude: 137.000000,
  },
  {
    id: "stamp-03",
    name: "スタンプ 3",
    image: "/assets/stamps/stamp-03.png",
    description: "3つ目の記念スタンプ",
    stampId: "stamp-03",
    label: "ターゲット 3",
    targetSrc: "/assets/targets/targets03.mind",
    modelSrc: "/assets/models/model03.glb",
    latitude: 35.000000, 
    longitude: 136.000000,
  },
];

export const TARGET_CONFIGS: Stamp[] = STAMPS;
export const STAMP_STORAGE_KEY = "webar-owned-stamps";