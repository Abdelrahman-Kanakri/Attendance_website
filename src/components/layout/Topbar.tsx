import { Menu, LogOut } from 'lucide-react';
import { useAuthContext } from '../../context/AuthContext';
import { Button } from '../ui/button';

interface TopbarProps {
  title: string;
  onMenu: () => void;
}

export function Topbar({ title, onMenu }: TopbarProps) {
  const { signOut } = useAuthContext();

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenu}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-gray-700 md:hidden"
          >
            <Menu size={18} />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        </div>

        <Button variant="outline" size="sm" onClick={() => void signOut()}>
          <LogOut size={14} className="mr-2" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
