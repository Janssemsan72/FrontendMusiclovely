import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Music } from "lucide-react";
import { getAdminDashboardStatusBadge } from "./statusBadge";

interface Song {
  id: string;
  title: string;
  status: string;
  release_at?: string;
  orders?: {
    customer_email: string;
  };
}

interface AdminDashboardSongsTabProps {
  songs: Song[];
  songsLoading: boolean;
}

export function AdminDashboardSongsTab({ songs, songsLoading }: AdminDashboardSongsTabProps) {
  return (
    <Card className="mobile-compact-card">
      <CardHeader className="p-3 md:p-6">
        <CardTitle className="text-base md:text-lg">Músicas Recentes</CardTitle>
      </CardHeader>
      <CardContent className="p-3 md:p-6 pt-0">
        <div className="space-y-4">
          {songsLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Carregando músicas...</div>
          ) : songs.length === 0 ? (
            <div className="text-center py-12">
              <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground text-sm font-medium mb-2">Nenhuma música encontrada</p>
              <p className="text-muted-foreground text-xs">
                Quando houver músicas, elas aparecerão aqui
              </p>
            </div>
          ) : (
            songs.map((song) => (
              <div
                key={song.id}
                className="flex items-start justify-between p-3 md:p-4 border rounded-lg gap-2"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <p className="text-xs md:text-sm font-medium truncate">{song.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{song.orders?.customer_email || "N/A"}</p>
                  {song.release_at && (
                    <p className="text-xs text-muted-foreground hidden md:block">
                      {new Date(song.release_at).toLocaleString("pt-BR")}
                    </p>
                  )}
                </div>
                <div className="shrink-0">{getAdminDashboardStatusBadge(song.status)}</div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

