"use client";
import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';

// Main App component
const App = () => {
  const [formData, setFormData] = useState({
    location: "",
    // optional fields filled from suggestion
    lat: null,
    lon: null,
    weather: null,
  });
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const locationInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  const [results, setResults] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const panelMeshRef = useRef(null);
  const controlsRef = useRef({
    isDragging: false,
    previousMousePosition: { x: 0, y: 0 },
  });

  // Constants
  const apiKey = "AIzaSyDQg9jLra_62YHaKs1CVbUn6ZbWz5HQe5o";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

  const showMessage = (message) => {
    setNotificationMessage(message);
    setShowNotification(true);
    setTimeout(() => {
      setShowNotification(false);
    }, 3000);
  };

  // Debounced Nominatim search
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
          console.error("Abort failed:", e);
        }
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const fetchSuggestions = async () => {
        try {
          const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=10&accept-language=en&q=${encodeURIComponent(q)}`;
          const res = await fetch(url, { signal: controller.signal });
          if (!res.ok) throw new Error(`Nominatim responded with ${res.status}`);
          const data = await res.json();
          const mapped = data.map((item) => ({
            label: item.display_name,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            address: item.address || {},
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
  useEffect(() => {
    if (!formData.lat || !formData.lon) return;

    const fetchWeather = async () => {
      try {
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${formData.lat}&lon=${formData.lon}&units=metric&appid=05ba077ea73a3c44323afe605e16a4c9`);
        if (!res.ok) throw new Error("Failed to fetch weather");
        const data = await res.json();
        setFormData(prev => ({ ...prev, weather: data }));
      } catch (err) {
        console.error(err);
        showMessage("Failed to fetch weather data.");
        setFormData(prev => ({ ...prev, weather: null }));
      }
    };
    fetchWeather();
  }, [formData.lat, formData.lon]);

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

  const handleCalculate = async () => {
    if (!formData.lat || !formData.lon) {
      showMessage("Please select a location from the search suggestions first.");
      return;
    }
    setLoading(true);

    let weatherCondition = "clear skies";
    if (formData.weather && formData.weather.weather && formData.weather.weather.length > 0) {
      weatherCondition = formData.weather.weather[0].description;
    }

    const systemPrompt = `
You are an expert solar energy consultant.
Respond ONLY with a single valid JSON object
with keys "optimalTilt" (number), "optimalAzimuth" (number), and "reasoning" (string).
No extra text or formatting.
`;
    const userQuery = `Based on a latitude of ${formData.lat} and longitude of ${formData.lon}, with current weather conditions of '${weatherCondition}', what are the optimal solar panel tilt and azimuth angles?`;

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
    };


    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const result = await response.text(); // Use .text() to inspect raw response
    console.log("Raw API response:", result);

    try {
        const json = JSON.parse(result);

        // Extract the model’s raw text
        let rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || "";

        // ✅ Remove markdown code fences and trim whitespace
        rawText = rawText
            .replace(/```json\s*/i, "")
            .replace(/```/g, "")
            .trim();

        console.log("Cleaned API text:", rawText);

        // Parse the cleaned JSON
        const parsedResults = JSON.parse(rawText);
        setResults(parsedResults);

    } catch (error) {
        console.error("Parsing error:", error);
        showMessage("Failed to parse API response. Please try again later.");
    }
    setLoading(false);
  };

  // Three.js setup
  useEffect(() => {
    if (!canvasRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x1a202c);

    // Camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    cameraRef.current = camera;
    camera.position.set(0, 5, 10);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
    rendererRef.current = renderer;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);

    // Ground Plane
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x2d3748, side: THREE.DoubleSide });
    const groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    groundPlane.rotation.x = Math.PI / 2;
    groundPlane.position.y = -0.5;
    scene.add(groundPlane);

    // Solar Panel Mesh
    const panelGeometry = new THREE.BoxGeometry(4, 0.2, 2.5);
    const panelMaterial = new THREE.MeshStandardMaterial({ color: 0x4299e1, metalness: 0.5, roughness: 0.2 });
    const panelMesh = new THREE.Mesh(panelGeometry, panelMaterial);
    panelMesh.position.y = 1;
    panelMeshRef.current = panelMesh;
    scene.add(panelMesh);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    // Manual Camera Controls
    const mouseMoveHandler = (e) => {
      if (controlsRef.current.isDragging) {
        const deltaMove = {
          x: e.clientX - controlsRef.current.previousMousePosition.x,
          y: e.clientY - controlsRef.current.previousMousePosition.y,
        };
        const rotationSpeed = 0.005;
        const newRotationY = camera.rotation.y - deltaMove.x * rotationSpeed;
        const newRotationX = camera.rotation.x - deltaMove.y * rotationSpeed;
        camera.rotation.y = newRotationY;
        camera.rotation.x = newRotationX;

        controlsRef.current.previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    };

    const mouseDownHandler = (e) => {
      controlsRef.current.isDragging = true;
      controlsRef.current.previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const mouseUpHandler = () => {
      controlsRef.current.isDragging = false;
    };

    canvasRef.current.addEventListener('mousedown', mouseDownHandler);
    canvasRef.current.addEventListener('mousemove', mouseMoveHandler);
    canvasRef.current.addEventListener('mouseup', mouseUpHandler);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);

      if (panelMeshRef.current && results) {
        const targetX = THREE.MathUtils.degToRad(-(results.optimalTilt || 0));
        const targetY = THREE.MathUtils.degToRad(results.optimalAzimuth || 0);

        panelMeshRef.current.rotation.x +=
          (targetX - panelMeshRef.current.rotation.x) * 0.05;
        panelMeshRef.current.rotation.y +=
          (targetY - panelMeshRef.current.rotation.y) * 0.05;
      }

      renderer.render(scene, camera);
    };

    const handleResize = () => {
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (canvasRef.current) {
        canvasRef.current.removeEventListener('mousedown', mouseDownHandler);
        canvasRef.current.removeEventListener('mousemove', mouseMoveHandler);
        canvasRef.current.removeEventListener('mouseup', mouseUpHandler);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 md:p-12 font-sans flex flex-col items-center">
      <header className="mb-12 text-center w-full max-w-4xl">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-sky-600 mb-2 drop-shadow-md">
          Solar Optimizer
        </h1>
        <p className="text-lg sm:text-xl text-slate-400">Find the optimal angles for your solar panels.</p>
      </header>

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Form Section */}
        <div className="bg-slate-900 rounded-xl shadow-2xl p-6 sm:p-8 transform transition-all duration-300 hover:scale-[1.01]">
          <h2 className="text-2xl font-bold mb-6 text-center text-slate-200">Get Recommendations</h2>
          <div className="space-y-6">
            <div className="relative">
              <label htmlFor="location" className="block text-sm font-medium text-slate-400 mb-2">
                Search Location
              </label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                ref={locationInputRef}
                autoComplete="off"
                className="w-full bg-slate-800 text-slate-200 border border-slate-700 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                aria-autocomplete="list"
                aria-expanded={suggestions.length > 0}
                placeholder="e.g., Mumbai"
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
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {formData.lat && formData.lon && (
              <div className="bg-slate-800 rounded-lg p-4 text-slate-300">
                <p><strong>Latitude:</strong> {formData.lat}</p>
                <p><strong>Longitude:</strong> {formData.lon}</p>
                {formData.weather && (
                  <p><strong>Weather:</strong> {formData.weather.weather[0].description}</p>
                )}
              </div>
            )}
            <button
              onClick={handleCalculate}
              className="w-full bg-gradient-to-r from-blue-500 to-sky-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:from-blue-600 hover:to-sky-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              disabled={loading || !formData.lat}
            >
              {loading ? "Calculating..." : "Get Optimal Angles"}
            </button>
          </div>
        </div>

        {/* 3D Animation and Results Section */}
        <div className="bg-slate-900 rounded-xl shadow-2xl p-6 sm:p-8 transform transition-all duration-300 hover:scale-[1.01]">
          <h2 className="text-2xl font-bold mb-6 text-center text-slate-200">Live Visualization</h2>
          <div className="relative w-full h-80 sm:h-96">
            <canvas ref={canvasRef} className="rounded-lg absolute inset-0 w-full h-full"></canvas>
            {showNotification && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-center py-2 px-4 rounded-lg shadow-xl z-20">
                {notificationMessage}
              </div>
            )}
          </div>
          {results && (
            <div className="mt-8 bg-slate-950 p-6 rounded-lg shadow-inner space-y-4">
              <h3 className="text-xl font-bold text-sky-400">Optimal Angles</h3>
              <p className="text-slate-300">
                Optimal Tilt Angle: <span className="font-bold text-blue-400">{results.optimalTilt}°</span>
              </p>
              <p className="text-slate-300">
                Optimal Azimuth Angle: <span className="font-bold text-blue-400">{results.optimalAzimuth}°</span>
              </p>
              <p className="text-slate-400 text-sm mt-4 italic">{results.reasoning}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
