import Link from 'next/link';
import { ROUTES } from '../utils/navigation';

export default function NotFound() {
  return (
    <div className="max-w-2xl mx-auto mt-8 text-center">
      <div className="text-red-700 bg-red-100 border border-red-300 p-4 rounded">
        Recipe not found!
      </div>
      <Link href={ROUTES.HOME} className="inline-block mt-4 text-sm text-stone-500 hover:text-stone-800">
        Back to Recipes
      </Link>
    </div>
  );
}
