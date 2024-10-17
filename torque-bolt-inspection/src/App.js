// src/App.js
import React, { useState, useEffect } from "react";
import axios from "axios";

const App = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [result, setResult] = useState("");
  const [inspections, setInspections] = useState([]);

  useEffect(() => {
    fetchInspections();
  }, []);

  // Function to fetch inspection results
  const fetchInspections = async () => {
    try {
      const response = await axios.get("http://localhost:5000/inspections");
      setInspections(response.data.inspections);
    } catch (error) {
      console.error("Error fetching inspections", error);
    }
  };

  // Function to handle file upload
  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert("Please select an image first.");
      return;
    }

    const formData = new FormData();
    formData.append("image", selectedFile);
    formData.append("result", result);

    try {
      await axios.post("http://localhost:5000/upload", formData);
      alert("Image uploaded successfully");
      fetchInspections(); // Refresh the list
    } catch (error) {
      console.error("Error uploading image", error);
    }
  };

  // Function to simulate image processing result
  const handleSimulateInspection = () => {
    // Here, instead of actual image processing, we simulate the result for the demo
    const possibleResults = ["aligned", "misaligned", "no-mark"];
    const randomResult = possibleResults[Math.floor(Math.random() * possibleResults.length)];
    setResult(randomResult);
  };

  return (
    <div className="App">
      <h1>Torque Bolt & Nut Inspection</h1>

      <input type="file" accept="image/*" onChange={handleFileChange} />
      <button onClick={handleSimulateInspection}>Simulate Inspection</button>

      {result && <p>Inspection Result: {result}</p>}

      <button onClick={handleUpload}>Upload Result</button>

      <h2>Previous Inspections</h2>
      <ul>
        {inspections.map((inspection) => (
          <li key={inspection.id}>
            <img
              src={`http://localhost:5000/${inspection.imagePath}`}
              alt="Torque Inspection"
              style={{ width: "100px" }}
            />
            <p>Result: {inspection.result}</p>
            <p>Time: {new Date(inspection.timestamp).toLocaleString()}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default App;
