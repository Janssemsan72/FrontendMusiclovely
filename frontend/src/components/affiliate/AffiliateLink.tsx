import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface AffiliateLinkProps {
  slug: string;
  url: string;
}

export default function AffiliateLink({ slug, url }: AffiliateLinkProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copiado para a área de transferência!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Erro ao copiar link');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seu Link de Afiliado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={url}
            readOnly
            className="font-mono text-sm"
          />
          <Button
            onClick={handleCopy}
            variant="outline"
            size="icon"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Button
            onClick={() => window.open(url, '_blank')}
            variant="outline"
            size="icon"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Compartilhe este link para ganhar comissões em cada venda realizada através dele.
        </p>
        <div className="bg-muted p-3 rounded-md">
          <p className="text-xs font-medium mb-1">Código do Afiliado:</p>
          <code className="text-sm font-mono">{slug}</code>
        </div>
      </CardContent>
    </Card>
  );
}

