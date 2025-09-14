"use client";

import React, { useEffect, useRef, useState } from "react";

/*
  SolarPredictor (Home) component
  - Fixed/updated:
    • Debounced location search (300ms) to avoid spamming Nominatim
    • AbortController to cancel previous requests
    • Limited search to India (&countrycodes=in) and added an email param for Nominatim
      (replace the email with your own to comply with the usage policy)
    • Fixed duplicate input names/ids (surfaceArea / irradiance etc.)
    • Numeric inputs are parsed to numbers before storing in state
    • Clicking a suggestion stores location, lat, lon and address into formData
    • Robust error handling and graceful empty states
*/

const PredictedOutputChart = ({ data = [] }) => {
  return (
    <div className="w-full bg-slate-800 rounded-lg p-4 flex flex-col items-center justify-center h-64 text-slate-300">
      <p className="text-xl font-bold mb-2">Predicted Solar Output</p>
      <div className="h-48 w-full flex items-end justify-around">
        {data.map((item, index) => (
          <div
            key={index}
            className="w-8 rounded-t-full bg-blue-500 transition-all duration-500"
            style={{ height: `${Math.max(4, Math.min(100, item.value))}%` }}
            title={`${item.label}: ${item.value}`}
          ></div>
        ))}
      </div>
      <div className="flex w-full justify-around mt-2 text-sm text-slate-400">
        {data.map((item, index) => (
          <span key={index}>{item.label}</span>
        ))}
      </div>
    </div>
  );
};

export default function Home() {
  const [formData, setFormData] = useState({
    location: "",
    panelCount: 1,
    tiltAngle: 30,
    azimuthAngle: 180,
    surfaceArea: 0,
    irradiance: 0,
    // optional fields filled from suggestion
    lat: null,
    lon: null,
    address: null,
  });

  const [predictedData, setPredictedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const locationInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Debounced Nominatim search (limited to India)
  useEffect(() => {
    const q = String(formData.location || "").trim();

    if (q.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      // Abort any previous request
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort();
        } catch (e) {
          // ignore
        }
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const fetchSuggestions = async () => {
        try {
          // IMPORTANT: Replace the email param with your contact email as recommended by Nominatim
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
          if (err.name === "AbortError") return; // expected on cancel
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

    // focus out of input after selecting suggestion
    if (locationInputRef.current) locationInputRef.current.blur();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);

    // Example: simulate a server/ML call. In production replace with real API.
    setTimeout(() => {
      const simulatedData = Array.from({ length: 12 }).map((_, i) => ({
        label: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i],
        value: Math.floor(Math.random() * 100) + 20,
      }));

      setPredictedData({
        chartData: simulatedData,
        dailyTotal: (Math.random() * 50).toFixed(2),
        optimalTilt: Math.floor(Math.random() * 30) + 15,
        optimalAzimuth: Math.floor(Math.random() * 360),
        optimalDailyTotal: (Math.random() * 50 + 10).toFixed(2),
      });
      setLoading(false);
    }, 1200);
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
    <h3 className="text-xl font-bold text-sky-400 mb-4">
      Current Weather
    </h3>
    <p className="text-slate-300">
      📍 {weather.name}, {weather.sys.country}
    </p>
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
                aria-autocomplete="list"
                aria-expanded={suggestions.length > 0}
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
                      role="option"
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
                <label htmlFor="irradiance" className="block text-sm font-medium text-slate-400 mb-2">
                  Irradiance (kW/m²)
                </label>
                <input
                  type="number"
                  id="irradiance"
                  name="irradiance"
                  value={formData.irradiance}
                  onChange={handleChange}
                  min={0}
                  step="0.01"
                  className="w-full bg-slate-800 text-slate-200 border border-slate-700 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-500 to-sky-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:from-blue-600 hover:to-sky-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              disabled={loading}
            >
              {loading ? "Predicting..." : "Get Prediction"}
            </button>
          </form>
        </div>

        {/* Prediction & Recommendations Section */}
        <div className="bg-slate-900 rounded-xl shadow-2xl p-6 sm:p-8 transform transition-all duration-300 hover:scale-[1.01]">
          <h2 className="text-2xl font-bold mb-6 text-center text-slate-200">Prediction & Recommendations</h2>

          {predictedData ? (
            <div className="space-y-6">
              <div className="bg-slate-950 p-6 rounded-lg shadow-inner">
                <h3 className="text-xl font-bold text-sky-400 mb-4">Predicted Annual Output</h3>
                <PredictedOutputChart data={predictedData.chartData} />
              </div>

              <div className="bg-slate-950 p-6 rounded-lg shadow-inner">
                <h3 className="text-xl font-bold text-sky-400 mb-4">Actionable Recommendations</h3>
                <p className="text-slate-300 mb-2">Based on your location, the optimal settings for your panels are:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>
                    Optimal Tilt Angle: <span className="font-bold text-blue-400">{predictedData.optimalTilt}°</span>
                  </li>
                  <li>
                    Optimal Azimuth Angle: <span className="font-bold text-blue-400">{predictedData.optimalAzimuth}°</span>
                  </li>
                </ul>

                <div className="mt-4 p-4 rounded-lg border-2 border-dashed border-sky-600 bg-sky-950/20">
                  <p className="text-sky-300">
                    Your current daily output prediction is{' '}
                    <span className="font-bold text-xl text-blue-400">{predictedData.dailyTotal} kWh.</span>
                  </p>
                  <p className="text-sky-300 mt-2">
                    By adjusting to the optimal angles, you could potentially increase your daily output to{' '}
                    <span className="font-bold text-xl text-blue-400">{predictedData.optimalDailyTotal} kWh.</span>
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
              <p className="mt-2 text-sm">This is a placeholder for your AI/ML model's output.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
