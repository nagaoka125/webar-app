export type StampSpot = {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  image?: string;
  arModelId?: string;
};

export const stampSpots: StampSpot[] = [
  {
    id: "spot-001",
    name: "スポットA",
    description: "1つ目のスタンプを獲得できます。",
    latitude: 34.7025,
    longitude: 135.4959,
    arModelId: "model-001",
  },
  {
    id: "spot-002",
    name: "スポットB",
    description: "2つ目のスタンプを獲得できます。",
    latitude: 34.7050,
    longitude: 135.5000,
    arModelId: "model-002",
  },
  {
    id: "spot-003",
    name: "スポットC",
    description: "3つ目のスタンプを獲得できます。",
    latitude: 34.6990,
    longitude: 135.5030,
    arModelId: "model-003",
  },
];
