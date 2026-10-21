import CameraButton from "./components/CameraButton"
import { useRouter } from "next/router"

export default function Home() {
  const router = useRouter();

  const routeStamp = () => {
      router.push("/stamp")
  };

  return (
    <main className="min-h-full flex flex-col items-center justify-start p-8">
      <h1 className="text-2xl font-bold mb-4">webARapp</h1>
      <CameraButton />
      <button
          type="button"
          onClick={routeStamp}
          style={{ minHeight: 48, padding: "12px 16px", fontSize: 16 }}
        >
          スタンプ帳
        </button>
    </main>
  )
}