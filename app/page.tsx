import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold">AllClear</h1>
        <p className="mt-2 text-neutral-500">
          Multilingual AI roll call for evacuation zones. Demo build: all resident data is synthetic; volunteer phones
          stand in for the phone network.
        </p>
      </div>
      <nav className="flex flex-col gap-2 text-blue-600">
        <Link href="/api/health">/api/health</Link>
      </nav>
    </main>
  );
}
