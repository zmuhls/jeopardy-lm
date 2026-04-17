import JeopardyGame from '../src/JeopardyGame';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-black p-4 md:p-8 lg:p-24">
      <JeopardyGame />
    </main>
  );
}
