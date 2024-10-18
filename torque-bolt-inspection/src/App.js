// src/App.js

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

const App = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [results, setResults] = useState([]);
  const [inspections, setInspections] = useState([]);
  const imageRef = useRef(null);

  const [cvReady, setCvReady] = useState(false);

  useEffect(() => {
    fetchInspections();

    // Check if OpenCV.js is ready
    const interval = setInterval(() => {
      if (window.cv && window.cv.imread) {
        setCvReady(true);
        clearInterval(interval);
      }
    }, 100); // check every 100ms

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
    if (imageRef.current) {
      imageRef.current.src = URL.createObjectURL(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert("Please select an image first.");
      return;
    }

    const formData = new FormData();
    formData.append("image", selectedFile);
    formData.append("results", JSON.stringify(results));

    try {
      await axios.post("http://localhost:5000/upload", formData);
      alert("Image uploaded successfully");
      fetchInspections(); // Refresh the list
    } catch (error) {
      console.error("Error uploading image", error);
    }
  };

  // Function to inspect each bolt
  const handleSimulateInspection = async () => {
    if (!cvReady) {
      alert("OpenCV.js is not yet loaded.");
      return;
    }

    const imgElement = imageRef.current;

    if (!imgElement) {
      alert("Please upload an image first.");
      return;
    }

    const src = window.cv.imread(imgElement); // Read image into OpenCV matrix
    const gray = new window.cv.Mat();
    const edges = new window.cv.Mat();
    const contours = new window.cv.MatVector();

    // Convert image to grayscale
    window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);

    // Detect edges in the image (Canny Edge Detection)
    window.cv.Canny(gray, edges, 50, 150);

    // Detect contours to isolate bolts (based on the edges)
    const hierarchy = new window.cv.Mat();
    window.cv.findContours(edges, contours, hierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);

    console.log(`Detected contours: ${contours.size()}`); // Debug: Number of contours detected

    let resultArray = [];
    let detectedBoltCount = 0;

    // Filter contours based on area and aspect ratio
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const boundingRect = window.cv.boundingRect(contour);

      // Apply contour filtering (manually adjusted area and aspect ratio based on bolt sizes)
      const area = boundingRect.width * boundingRect.height;
      const aspectRatio = boundingRect.width / boundingRect.height;

      console.log(`Contour ${i}: Area = ${area}, Aspect Ratio = ${aspectRatio}`); // Debug: Log area and aspect ratio

      // Set thresholds based on expected bolt size and shape
      if (area > 800 && area < 3000 && aspectRatio > 0.9 && aspectRatio < 1.1) {
        console.log(`Contour ${i} accepted as a bolt.`); // Debug: Mark contour as valid

        // Count valid bolts
        detectedBoltCount++;

        // Extract each bolt's region using bounding rectangles
        const boltRegion = src.roi(boundingRect);
        const boltGray = new window.cv.Mat();
        const boltEdges = new window.cv.Mat();

        // Convert region to grayscale and detect edges
        window.cv.cvtColor(boltRegion, boltGray, window.cv.COLOR_RGBA2GRAY);
        window.cv.Canny(boltGray, boltEdges, 50, 100);

        // Draw bounding box around each detected bolt (for visual debugging)
        window.cv.rectangle(src, new window.cv.Point(boundingRect.x, boundingRect.y), new window.cv.Point(boundingRect.x + boundingRect.width, boundingRect.y + boundingRect.height), new window.cv.Scalar(0, 255, 0), 2); 

        // Detect lines using Hough Transform
        const lines = new window.cv.Mat();
        window.cv.HoughLinesP(boltEdges, lines, 1, Math.PI / 180, 15, 10, 3); // Lowered thresholds

        let paintMarkFound = false;
        let isAligned = false;

        // Draw lines on the original image for debugging
        for (let j = 0; j < lines.rows; j++) {
          const x1 = lines.data32S[j * 4];
          const y1 = lines.data32S[j * 4 + 1];
          const x2 = lines.data32S[j * 4 + 2];
          const y2 = lines.data32S[j * 4 + 3];

          // Draw lines on the bolt region for visualization (red color)
          window.cv.line(boltRegion, new window.cv.Point(x1, y1), new window.cv.Point(x2, y2), new window.cv.Scalar(255, 0, 0), 2);

          // Check for near-vertical or near-horizontal lines
          if (Math.abs(x1 - x2) < 10 || Math.abs(y1 - y2) < 10) {
            paintMarkFound = true;
            isAligned = true; // Assume aligned if we find a vertical/horizontal line
          }
        }

        let result = "no-mark";
        if (paintMarkFound) {
          result = isAligned ? "aligned" : "misaligned";
        }

        // Push result for the current bolt
        resultArray.push(result);

        // Clean up region-specific Mats
        boltRegion.delete();
        boltGray.delete();
        boltEdges.delete();
        lines.delete();
      }
    }

    console.log("Detected bolts count: ", detectedBoltCount); // Debugging bolt count
    console.log("Results: ", resultArray); // Debugging results

    if (resultArray.length === 0) {
      console.log("No valid bolts detected."); // Debug: If no valid bolts are found
    } else {
      console.log("Detected bolts: ", resultArray); // Debug: Log results
    }

    // Set the results for the detected bolts
    setResults(resultArray);

    // Clean up
    src.delete();
    gray.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
  };

  return (
    <div className="App">
      <h1>Torque Bolt & Nut Inspection</h1>

      <input type="file" accept="image/*" onChange={handleFileChange} />
      <img ref={imageRef} alt="Preview" width="300px" />

      <button onClick={handleSimulateInspection} disabled={!cvReady}>
        Inspect Image
      </button>

      {results.length > 0 && (
        <div>
          <h2>Inspection Results:</h2>
          <ul>
            {results.map((result, index) => (
              <li key={index}>
                Bolt {index + 1}: {result}
              </li>
            ))}
          </ul>
        </div>
      )}

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
            <p>Results: {inspection.results}</p>
            <p>Time: {new Date(inspection.timestamp).toLocaleString()}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default App;
