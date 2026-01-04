import { useEffect, useState } from "react";
import { Cloud, CloudRain, Sun, CloudSun, Droplets, Wind } from "lucide-react";

interface WeatherData {
  temp: number;
  description: string;
  humidity: number;
  windSpeed: number;
  icon: string;
}

export function WeatherWidget() {
  const [enabled, setEnabled] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("e2e_admin") === "true") {
      setEnabled(false);
      return;
    }

    const media = window.matchMedia("(min-width: 1280px)");
    const update = () => setEnabled(media.matches);
    update();

    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  // Atualizar hora a cada segundo
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [enabled]);

  // Buscar dados do clima
  useEffect(() => {
    if (!enabled) return;
    const fetchWeather = async () => {
      try {
        const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || "demo";
        
        if (API_KEY === "demo" || !API_KEY) {
          setWeather(null);
          setLoading(false);
          return;
        }

        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=-3.7172&lon=-38.5433&units=metric&lang=pt_br&appid=${API_KEY}`
        );

        if (response.ok) {
          const data = await response.json();
          setWeather({
            temp: Math.round(data.main.temp),
            description: data.weather[0].description,
            humidity: data.main.humidity,
            windSpeed: Math.round(data.wind.speed * 3.6), // converter m/s para km/h
            icon: data.weather[0].icon
          });
        } else {
          setWeather(null);
        }
      } catch (error) {
        console.error("Erro ao buscar clima:", error);
        setWeather(null);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    // Atualizar clima a cada 10 minutos
    const interval = setInterval(fetchWeather, 600000);
    return () => clearInterval(interval);
  }, [enabled]);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(date);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  };

  const getWeatherIcon = (icon: string) => {
    if (icon.includes("01")) return <Sun className="h-4 w-4 text-yellow-500" />;
    if (icon.includes("02")) return <CloudSun className="h-4 w-4 text-yellow-400" />;
    if (icon.includes("03") || icon.includes("04")) return <Cloud className="h-4 w-4 text-gray-400" />;
    if (icon.includes("09") || icon.includes("10")) return <CloudRain className="h-4 w-4 text-blue-400" />;
    return <CloudSun className="h-4 w-4 text-gray-400" />;
  };

  if (!enabled) return null;

  return (
    <div className="hidden xl:flex items-center gap-4">
      {/* Data e Hora */}
      <div className="flex flex-col items-center">
        <div className="text-[10px] font-medium text-gray-600 dark:text-gray-400 leading-tight tracking-wide uppercase">
          {formatDate(currentTime)}
        </div>
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-50 tabular-nums tracking-tight mt-0.5">
          {formatTime(currentTime)}
        </div>
      </div>

      {loading || weather ? (
        <>
          <div className="h-8 w-px bg-gray-200/60 dark:bg-gray-700/60" />
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full border-2 border-gray-300/50 border-t-gray-600 dark:border-gray-600/50 dark:border-t-gray-400 animate-spin" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Carregando...</span>
            </div>
          ) : weather ? (
            <>
              <div className="flex items-center gap-2">
                {getWeatherIcon(weather.icon)}
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-base font-semibold text-gray-900 dark:text-gray-50 tracking-tight">
                      {weather.temp}
                    </span>
                    <span className="text-[10px] text-gray-600 dark:text-gray-400">°C</span>
                  </div>
                  <div className="text-[9px] text-gray-600 dark:text-gray-400 capitalize leading-tight max-w-[85px] truncate">
                    {weather.description}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 text-[9px] text-gray-600 dark:text-gray-400 pl-2 border-l border-gray-200/60 dark:border-gray-700/60">
                <div className="flex items-center gap-1">
                  <Droplets className="h-3 w-3" />
                  <span>{weather.humidity}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <Wind className="h-3 w-3" />
                  <span>{weather.windSpeed}km/h</span>
                </div>
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
