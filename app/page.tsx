import CameraButton from "./components/CameraButton"

export default function Home() {
  return (
    <main className="min-h-full flex flex-col items-center justify-start p-8">
      <h1 className="text-2xl font-bold mb-4">webARapp</h1>
      <CameraButton />
    </main>
  )
}