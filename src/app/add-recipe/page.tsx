import type { Metadata } from 'next';
import AddRecipePage from '../../views/AddRecipePage';

export const metadata: Metadata = {
  title: 'Add Recipe',
};

export default function Page() {
  return <AddRecipePage />;
}
