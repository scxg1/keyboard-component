import MechanicalKeyboard from "@/components/mechanical-keyboard"

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#121212]">
      <div className="w-full max-w-5xl p-4">
        <MechanicalKeyboard />
      </div>
    </main>
  )
}
