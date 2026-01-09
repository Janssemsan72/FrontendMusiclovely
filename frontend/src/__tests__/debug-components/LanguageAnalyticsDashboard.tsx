import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Globe, Users, Clock, Trash2, RefreshCw } from 'lucide-react';
import languageAnalytics from '@/lib/languageAnalytics';
import translationCache from '@/lib/translationCache';
import lazyTranslations from '@/lib/lazyTranslations';

interface AnalyticsStats {
  totalEvents: number;
  byLocale: Record<string, number>;
  bySource: Record<string, number>;
  recentEvents: Array<{
    locale: string;
    source: string;
    timestamp: number;
    path?: string;
    country?: string;
  }>;
}

interface CacheStats {
  size: number;
  maxSize: number;
  entries: Array<{
    locale: string;
    age: number;
    version: string;
  }>;
}

export default function LanguageAnalyticsDashboard() {
  const [analyticsStats, setAnalyticsStats] = useState<AnalyticsStats | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [loadingStats, setLoadingStats] = useState<{ loaded: string[]; loading: string[] } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshStats = async () => {
    setIsRefreshing(true);
    try {
      const analytics = languageAnalytics.getStats();
      const cache = translationCache.getStats();
      const loading = lazyTranslations.getStats();

      setAnalyticsStats(analytics);
      setCacheStats(cache);
      setLoadingStats(loading);
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshStats();
  }, []);

  const clearAllData = () => {
    languageAnalytics.clear();
    translationCache.clear();
    lazyTranslations.clear();
    refreshStats();
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatAge = (age: number) => {
    const minutes = Math.floor(age / 60000);
    const seconds = Math.floor((age % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const getSourceColor = (source: string) => {
    const colors: Record<string, string> = {
      detection: 'bg-blue-100 text-blue-800',
      manual: 'bg-green-100 text-green-800',
      url: 'bg-purple-100 text-purple-800',
      cookie: 'bg-orange-100 text-orange-800'
    };
    return colors[source] || 'bg-gray-100 text-gray-800';
  };

  const getLocaleFlag = (locale: string) => {
    const flags: Record<string, string> = {
      pt: '🇧🇷',
      en: '🇺🇸',
      es: '🇪🇸'
    };
    return flags[locale] || '🌍';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">📊 Language Analytics Dashboard</h1>
          <p className="text-muted-foreground">Monitoramento de uso de idiomas e performance</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={refreshStats}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            onClick={clearAllData}
            variant="destructive"
            size="sm"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar Dados
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
          <TabsTrigger value="loading">Carregamento</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Eventos</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analyticsStats?.totalEvents || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Eventos de idioma registrados
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cache Ativo</CardTitle>
                <Globe className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {cacheStats?.size || 0}/{cacheStats?.maxSize || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Idiomas em cache
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Carregados</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loadingStats?.loaded.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Idiomas carregados
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Uso por Idioma</CardTitle>
                <CardDescription>Distribuição de eventos por idioma</CardDescription>
              </CardHeader>
              <CardContent>
                {analyticsStats?.byLocale && Object.entries(analyticsStats.byLocale).map(([locale, count]) => (
                  <div key={locale} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getLocaleFlag(locale)}</span>
                      <span className="font-medium">{locale.toUpperCase()}</span>
                    </div>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fonte de Detecção</CardTitle>
                <CardDescription>Como os idiomas foram detectados</CardDescription>
              </CardHeader>
              <CardContent>
                {analyticsStats?.bySource && Object.entries(analyticsStats.bySource).map(([source, count]) => (
                  <div key={source} className="flex items-center justify-between py-2">
                    <Badge className={getSourceColor(source)}>
                      {source}
                    </Badge>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Eventos Recentes</CardTitle>
              <CardDescription>Últimos eventos de idioma registrados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analyticsStats?.recentEvents.map((event, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{getLocaleFlag(event.locale)}</span>
                      <div>
                        <div className="font-medium">{event.locale.toUpperCase()}</div>
                        <div className="text-sm text-muted-foreground">
                          {event.path && `Path: ${event.path}`}
                          {event.country && ` • País: ${event.country}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={getSourceColor(event.source)}>
                        {event.source}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatTimestamp(event.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cache" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cache de Traduções</CardTitle>
              <CardDescription>Status do cache de traduções</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Entradas em Cache:</span>
                  <Badge variant="outline">
                    {cacheStats?.size || 0} / {cacheStats?.maxSize || 0}
                  </Badge>
                </div>
                
                {cacheStats?.entries.map((entry, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getLocaleFlag(entry.locale)}</span>
                      <span className="font-medium">{entry.locale.toUpperCase()}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm">Idade: {formatAge(entry.age)}</div>
                      <div className="text-xs text-muted-foreground">v{entry.version}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loading" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Idiomas Carregados</CardTitle>
                <CardDescription>Idiomas já carregados na memória</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {loadingStats?.loaded.map(locale => (
                    <div key={locale} className="flex items-center gap-2">
                      <span className="text-lg">{getLocaleFlag(locale)}</span>
                      <span className="font-medium">{locale.toUpperCase()}</span>
                      <Badge variant="default">Carregado</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Carregando</CardTitle>
                <CardDescription>Idiomas sendo carregados</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {loadingStats?.loading.map(locale => (
                    <div key={locale} className="flex items-center gap-2">
                      <span className="text-lg">{getLocaleFlag(locale)}</span>
                      <span className="font-medium">{locale.toUpperCase()}</span>
                      <Badge variant="secondary">Carregando...</Badge>
                    </div>
                  ))}
                  {loadingStats?.loading.length === 0 && (
                    <p className="text-muted-foreground text-sm">Nenhum idioma sendo carregado</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}


