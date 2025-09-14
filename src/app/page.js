"use client";

import React, { useEffect, useRef, useState } from "react";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const LineChart = ({ currentPowers = [], optimalPowers = [] }) => {
  const data = {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [
      {
        label: "Current Config",
        data: currentPowers,
        borderColor: "rgba(59, 130, 246, 1)",
        backgroundColor: "rgba(59, 130, 246, 0.2)",
        fill: false,
        tension: 0.3,
      },
      {
        label: "Optimal Config",
        data: optimalPowers,
        borderColor: "rgba(34, 197, 94, 1)",
        backgroundColor: "rgba(34, 197, 94, 0.2)",
        fill: false,
        tension: 0.3,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { position: "top" },
      title: { display: true, text: "Hourly Solar Power Prediction", color: "#e2e8f0" },
    },
    scales: {
      x: { title: { display: true, text: "Hour of Day", color: "#e2e8f0" }, ticks: { color: "#e2e8f0" } },
      y: { title: { display: true, text: "Power (W)", color: "#e2e8f0" }, ticks: { color: "#e2e8f0" }, beginAtZero: true },
    },
  };

  return (
    <div className="w-full bg-slate-800 rounded-lg p-4">
      <Line data={data} options={options} />
    </div>
  );
};

const BarChart = ({ currentKWh = 0, optimalKWh = 0 }) => {
  const data = {
    labels: ["Current", "Optimal"],
    datasets: [
      {
        label: "Daily Output (kWh)",
        data: [currentKWh, optimalKWh],
        backgroundColor: ["rgba(59, 130, 246, 0.5)", "rgba(34, 197, 94, 0.5)"],
        borderColor: ["rgba(59, 130, 246, 1)", "rgba(34, 197, 94, 1)"],
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { position: "top" },
      title: { display: true, text: "Daily Solar Output Comparison", color: "#e2e8f0" },
    },
    scales: {
      y: { title: { display: true, text: "Daily kWh", color: "#e2e8f0" }, ticks: { color: "#e2e8f0" }, beginAtZero: true },
      x: { ticks: { color: "#e2e8f0" } },
    },
  };

  return (
    <div className="w-full bg-slate-800 rounded-lg p-4">
      <Bar data={data} options={options} />
    </div>
  );
};

export default function Home() {
  function getDayOfYear(date = new Date()) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    const oneDay = 1000 * 60 * 60 * 24;
    const day = Math.floor(diff / oneDay);
    return day;
  }
  // Intermediate value: formData state for input fields and prediction
  const [formData, setFormData] = useState({
    location: "",
    panelCount: 1,
    tiltAngle: 30,
    azimuthAngle: 180,
    surfaceArea: 10,
    lat: null,
    lon: null,
    address: null,
    temp: 25,
    dewPoint: 20,
    cloudCover: 0,
    windSpeed: 0,
    windDir: 0,
    pressure: 1013,
    albedo: 0.2,
    dayOfYear: getDayOfYear(), // Calculate current day of year
  });

  const [predictedData, setPredictedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [trainLoading, setTrainLoading] = useState(false);
  const [trainStatus, setTrainStatus] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const locationInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Extend Date prototype to get day of year
  Date.prototype.getDOY = function () {
    const start = new Date(this.getFullYear(), 0, 0);
    const diff = this - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  };

  // Debounced Nominatim search (limited to India)
  useEffect(() => {
    const q = String(formData.location || "").trim();

    if (q.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort();
        } catch (e) {
          /* ignore */
        }
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const fetchSuggestions = async () => {
        try {
          const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=10&countrycodes=in&accept-language=en&q=${encodeURIComponent(
            q
          )}&email=srishtiahuja26@gmail.com`;

          const res = await fetch(url, { signal: controller.signal });
          if (!res.ok) throw new Error(`Nominatim responded with ${res.status}`);

          const data = await res.json();
          const mapped = (data || []).map((item) => ({
            label: item.display_name,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            address: item.address || {},
            type: item.type || "",
          }));

          setSuggestions(mapped);
        } catch (err) {
          if (err.name === "AbortError") return;
          console.error("Location fetch error:", err);
          setSuggestions([]);
        }
      };

      fetchSuggestions();
    }, 300);

    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort();
        } catch (e) {
          /* ignore */
        }
      }
    };
  }, [formData.location]);

  // Fetch weather data
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    if (!formData.lat || !formData.lon) return;

    const fetchWeather = async () => {
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${formData.lat}&lon=${formData.lon}&units=metric&appid=05ba077ea73a3c44323afe605e16a4c9`
        );
        if (!res.ok) throw new Error("Failed to fetch weather");
        const data = await res.json();
        setWeather(data);
        setFormData((prev) => ({
          ...prev,
          temp: data.main.temp,
          dewPoint: data.main.temp - 5, // Approximate dew point
          cloudCover: data.clouds.all,
          windSpeed: data.wind.speed,
          windDir: data.wind.deg,
          pressure: data.main.pressure,
        }));
      } catch (err) {
        console.error(err);
        setWeather(null);
      }
    };

    fetchWeather();
  }, [formData.lat, formData.lon]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? (value === "" ? "" : Number(value)) : value,
    }));
  };

  const handleSuggestionClick = (suggestion) => {
    setFormData((prev) => ({
      ...prev,
      location: suggestion.label,
      lat: suggestion.lat,
      lon: suggestion.lon,
      address: suggestion.address,
    }));
    setSuggestions([]);
    if (locationInputRef.current) locationInputRef.current.blur();
  };

  const handleTrain = async () => {
    setTrainLoading(true);
    setTrainStatus(null);
    try {
      const response = await fetch("http://127.0.0.1:8000/api/train/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (response.ok) {
        setTrainStatus({ success: true, message: "Model trained successfully!", metrics: data.metrics });
      } else {
        setTrainStatus({ success: false, message: data.error || "Training failed." });
      }
    } catch (err) {
      setTrainStatus({ success: false, message: "Error: " + err.message });
    } finally {
      setTrainLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.lat || !formData.lon) {
      alert("Please select a valid location.");
      return;
    }
    setLoading(true);

    try {
      const response = await fetch("http://localhost:8000/api/predict/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: formData.lat,
          lon: formData.lon,
          area: formData.surfaceArea,
          tilt: formData.tiltAngle,
          azimuth: formData.azimuthAngle,
          temp: formData.temp,
          dew_point: formData.dewPoint,
          cloud_cover: formData.cloudCover,
          wind_speed: formData.windSpeed,
          wind_dir: formData.windDir,
          pressure: formData.pressure,
          albedo: formData.albedo,
          day_of_year: formData.dayOfYear,
        }),
      });

      if (!response.ok) throw new Error(`API responded with ${response.status}`);
      const data = await response.json();

      setPredictedData({
        current: {
          dailyTotal: data.current.daily_kwh,
          hourlyPowers: data.current.hourly_powers,
        },
        optimal: {
          dailyTotal: data.optimal.daily_kwh,
          tilt: data.optimal.tilt,
          azimuth: data.optimal.azimuth,
          hourlyPowers: data.optimal.hourly_powers || data.current.hourly_powers, // Fallback if optimal hourly not provided
        },
      });
    } catch (err) {
      console.error("Prediction error:", err);
      alert("Failed to fetch prediction: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 md:p-12">
      <header className="mb-12 text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-sky-600 mb-2 drop-shadow-md">
          Solar Power Predictor
        </h1>
        <p className="text-lg sm:text-xl text-slate-400">Analyze and optimize your solar energy generation.</p>
      </header>

      {weather && (
        <div className="bg-slate-950 p-6 rounded-lg shadow-inner mt-6">
          <h3 className="text-xl font-bold text-sky-400 mb-4">Current Weather</h3>
          <p className="text-slate-300">📍 {weather.name}, {weather.sys.country}</p>
          <p className="text-slate-300">🌡 Temp: {weather.main.temp} °C</p>
          <p className="text-slate-300">☁ Condition: {weather.weather[0].description}</p>
          <p className="text-slate-300">💨 Wind: {weather.wind.speed} m/s</p>
          <p className="text-slate-300">💧 Humidity: {weather.main.humidity}%</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
        {/* Input Form Section */}
        <div className="bg-slate-900 rounded-xl shadow-2xl p-6 sm:p-8 transform transition-all duration-300 hover:scale-[1.01]">
          <h2 className="text-2xl font-bold mb-6 text-center text-slate-200">Enter Your Site Details</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <label htmlFor="location" className="block text-sm font-medium text-slate-400 mb-2">
                Location (e.g., City, Area)
              </label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                ref={locationInputRef}
                autoComplete="off"
                className="w-full bg-slate-800 text-slate-200 border border-slate-700 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                placeholder="Type city, area or locality"
                required
              />
              {suggestions.length > 0 && (
                <ul className="absolute z-10 w-full bg-slate-800 border border-slate-700 rounded-lg mt-1 max-h-48 overflow-y-auto">
                  {suggestions.map((s, index) => (
                    <li
                      key={`${s.lat}-${s.lon}-${index}`}
                      onClick={() => handleSuggestionClick(s)}
                      className="px-4 py-2 text-slate-200 hover:bg-slate-700 cursor-pointer transition-colors"
                    >
                      <div className="text-sm">{s.label}</div>
                      <div className="text-xs text-slate-400">
                        {s.address.city || s.address.town || s.address.village || s.address.county || s.address.state || ""}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label htmlFor="panelCount" className="block text-sm font-medium text-slate-400 mb-2">
                Number of Solar Panels
              </label>
              <input
                type="number"
                id="panelCount"
                name="panelCount"
                value={formData.panelCount}
                onChange={handleChange}
                min={1}
                className="w-full bg-slate-800 text-slate-200 border border-slate-700 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="tiltAngle" className="block text-sm font-medium text-slate-400 mb-2">
                  Panel Tilt Angle (degrees)
                </label>
                <input
                  type="number"
                  id="tiltAngle"
                  name="tiltAngle"
                  value={formData.tiltAngle}
                  onChange={handleChange}
                  min={0}
                  max={90}
                  className="w-full bg-slate-800 text-slate-200 border border-slate-700 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label htmlFor="azimuthAngle" className="block text-sm font-medium text-slate-400 mb-2">
                  Panel Azimuth Angle (degrees)
                </label>
                <input
                  type="number"
                  id="azimuthAngle"
                  name="azimuthAngle"
                  value={formData.azimuthAngle}
                  onChange={handleChange}
                  min={0}
                  max={360}
                  className="w-full bg-slate-800 text-slate-200 border border-slate-700 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label htmlFor="surfaceArea" className="block text-sm font-medium text-slate-400 mb-2">
                  Surface Area (m²)
                </label>
                <input
                  type="number"
                  id="surfaceArea"
                  name="surfaceArea"
                  value={formData.surfaceArea}
                  onChange={handleChange}
                  min={0}
                  step="0.1"
                  className="w-full bg-slate-800 text-slate-200 border border-slate-700 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label htmlFor="albedo" className="block text-sm font-medium text-slate-400 mb-2">
                  Surface Albedo (0–1)
                </label>
                <input
                  type="number"
                  id="albedo"
                  name="albedo"
                  value={formData.albedo}
                  onChange={handleChange}
                  min={0}
                  max={1}
                  step="0.01"
                  className="w-full bg-slate-800 text-slate-200 border border-slate-700 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  required
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={handleTrain}
                className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                disabled={trainLoading}
              >
                {trainLoading ? "Training..." : "Train Model"}
              </button>
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-500 to-sky-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:from-blue-600 hover:to-sky-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                disabled={loading}
              >
                {loading ? "Predicting..." : "Get Prediction"}
              </button>
            </div>
          </form>
          {trainStatus && (
            <div className={`mt-4 p-4 rounded-lg ${trainStatus.success ? "bg-green-950/50" : "bg-red-950/50"}`}>
              <p className={trainStatus.success ? "text-green-400" : "text-red-400"}>{trainStatus.message}</p>
              {trainStatus.metrics && (
                <div className="mt-2 text-slate-300">
                  <p>MSE: {trainStatus.metrics.MSE.toFixed(4)}</p>
                  <p>RMSE: {trainStatus.metrics.RMSE.toFixed(4)} W</p>
                  <p>MAE: {trainStatus.metrics.MAE.toFixed(4)} W</p>
                  <p>R2: {trainStatus.metrics.R2.toFixed(4)}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Prediction & Recommendations Section */}
        <div className="bg-slate-900 rounded-xl shadow-2xl p-6 sm:p-8 transform transition-all duration-300 hover:scale-[1.01]">
          <h2 className="text-2xl font-bold mb-6 text-center text-slate-200">Prediction & Recommendations</h2>

          {predictedData ? (
            <div className="space-y-6">
              <div className="bg-slate-950 p-6 rounded-lg shadow-inner">
                <h3 className="text-xl font-bold text-sky-400 mb-4">Hourly Solar Output</h3>
                <LineChart currentPowers={predictedData.current.hourlyPowers} optimalPowers={predictedData.optimal.hourlyPowers} />
              </div>

              <div className="bg-slate-950 p-6 rounded-lg shadow-inner">
                <h3 className="text-xl font-bold text-sky-400 mb-4">Daily Solar Output</h3>
                <BarChart currentKWh={predictedData.current.dailyTotal} optimalKWh={predictedData.optimal.dailyTotal} />
              </div>

              <div className="bg-slate-950 p-6 rounded-lg shadow-inner">
                <h3 className="text-xl font-bold text-sky-400 mb-4">Actionable Recommendations</h3>
                <p className="text-slate-300 mb-2">Based on your location, the optimal settings for your panels are:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>
                    Optimal Tilt Angle: <span className="font-bold text-blue-400">{predictedData.optimal.tilt}°</span>
                  </li>
                  <li>
                    Optimal Azimuth Angle: <span className="font-bold text-blue-400">{predictedData.optimal.azimuth}°</span>
                  </li>
                </ul>

                <div className="mt-4 p-4 rounded-lg border-2 border-dashed border-sky-600 bg-sky-950/20">
                  <p className="text-sky-300">
                    Your current daily output prediction is{' '}
                    <span className="font-bold text-xl text-blue-400">{predictedData.current.dailyTotal.toFixed(2)} kWh.</span>
                  </p>
                  <p className="text-sky-300 mt-2">
                    By adjusting to the optimal angles, you could potentially increase your daily output to{' '}
                    <span className="font-bold text-xl text-blue-400">{predictedData.optimal.dailyTotal.toFixed(2)} kWh.</span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 p-8">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-16 h-16 mb-4 animate-bounce text-yellow-500"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364 1.364-1.591 1.591M21 12h-2.25m-1.364 6.364-1.591-1.591M12 18.75V21m-6.364-1.364 1.591-1.591M3 12H5.25m1.364-6.364 1.591 1.591M12 12a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" />
              </svg>
              <p className="text-lg">Enter your details and click "Get Prediction" to see your solar output.</p>
              <p className="mt-2 text-sm">Train the model first if not already done.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}