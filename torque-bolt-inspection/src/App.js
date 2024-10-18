import React, { useState, useEffect, useRef } from "react";

const App = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [results, setResults] = useState([]);
  const imageRef = useRef(null);
  const [cvReady, setCvReady] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (window.cv && window.cv.imread) {
        setCvReady(true);
        clearInterval(interval);
      }
    }, 100);
  }, []);

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
    if (imageRef.current) {
      imageRef.current.src = URL.createObjectURL(e.target.files[0]);
    }
  };

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

    const src = window.cv.imread(imgElement);
    const gray = new window.cv.Mat();
    const sobelX = new window.cv.Mat();
    const sobelY = new window.cv.Mat();
    const sobelCombined = new window.cv.Mat();
    const absSobelCombined = new window.cv.Mat();
    const contours = new window.cv.MatVector();
    const hierarchy = new window.cv.Mat();
    const morphKernel = new window.cv.Mat();

    // Convert image to grayscale
    window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);

    // Apply Gaussian Blur to reduce noise
    window.cv.GaussianBlur(gray, gray, new window.cv.Size(5, 5), 0);

    // Apply binary thresholding
    window.cv.threshold(gray, gray, 95, 255, window.cv.THRESH_BINARY);

    // Sobel edge detection (detect edges in X and Y directions)
    window.cv.Sobel(gray, sobelX, window.cv.CV_64F, 1, 0, 3);
    window.cv.Sobel(gray, sobelY, window.cv.CV_64F, 0, 1, 3);

    // Combine Sobel X and Y to get combined edges
    window.cv.addWeighted(sobelX, 0.5, sobelY, 0.5, 0, sobelCombined);

    // Convert combined Sobel edges to absolute values (required for contour detection)
    window.cv.convertScaleAbs(sobelCombined, absSobelCombined);

    // Morphological operations (dilation followed by erosion)
    morphKernel.create(5, 5, window.cv.CV_8UC1);
    window.cv.dilate(absSobelCombined, absSobelCombined, morphKernel, new window.cv.Point(-1, -1), 3);
    window.cv.erode(absSobelCombined, absSobelCombined, morphKernel, new window.cv.Point(-1, -1), 2);

    // Find contours(shape) based on the processed edges
    window.cv.findContours(absSobelCombined, contours, hierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);

    console.log(`Detected contours: ${contours.size()}`);

    let resultArray = [];
    let detectedBoltCount = 0;

    // Visualize and log all contours
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const approx = new window.cv.Mat(); // Contour approximation to simplify shape

      window.cv.approxPolyDP(contour, approx, 0.02 * window.cv.arcLength(contour, true), true);

      const area = window.cv.contourArea(approx); 
      const perimeter = window.cv.arcLength(approx, true);
      const circularity = (4 * Math.PI * area) / (perimeter * perimeter);

      console.log(`Contour ${i}: Area = ${area}, Perimeter = ${perimeter}, Circularity = ${circularity}`);

      // Adjusted thresholds for more robust bolt detection
      if (area > 800 && area < 6000 && circularity > 0.2) {
        console.log(`Contour ${i} accepted as a bolt.`);
        detectedBoltCount++;

        const boundingRect = window.cv.boundingRect(approx);
        const boundingBoxColor = new window.cv.Scalar(0, 255, 0);
        window.cv.rectangle(
          src,
          new window.cv.Point(boundingRect.x, boundingRect.y),
          new window.cv.Point(boundingRect.x + boundingRect.width, boundingRect.y + boundingRect.height),
          boundingBoxColor,
          2
        );

        // Extract each bolt's region using bounding rectangles
        const boltRegion = src.roi(boundingRect);
        const result = detectLines(boltRegion);

        resultArray.push(result);
        boltRegion.delete();
      }

      approx.delete();
    }

    console.log("Detected bolts count: ", detectedBoltCount);
    console.log("Results: ", resultArray);

    window.cv.imshow('canvasOutput', src); // Show the image with contours drawn

    // Clean up memory
    src.delete();
    gray.delete();
    sobelX.delete();
    sobelY.delete();
    sobelCombined.delete();
    absSobelCombined.delete();
    contours.delete();
    hierarchy.delete();
    morphKernel.delete();
  };

  const detectLines = (boltRegion) => {
    const boltGray = new window.cv.Mat();
    const boltEdges = new window.cv.Mat();
    const lines = new window.cv.Mat();

    // Convert region to grayscale and detect edges
    window.cv.cvtColor(boltRegion, boltGray, window.cv.COLOR_RGBA2GRAY);
    window.cv.Canny(boltGray, boltEdges, 50, 100);

    // Detect lines using Hough Transform with refined parameters
    window.cv.HoughLinesP(boltEdges, lines, 1, Math.PI / 180, 30, 50, 15); 

    let paintMarkFound = false;
    let isAligned = false;

    // Iterate through detected lines
    for (let j = 0; j < lines.rows; j++) {
      const x1 = lines.data32S[j * 4];
      const y1 = lines.data32S[j * 4 + 1];
      const x2 = lines.data32S[j * 4 + 2];
      const y2 = lines.data32S[j * 4 + 3];

      // Calculate line length
      const lineLength = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

      // Check for minimum line length
      if (lineLength > 20) {
        const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
        console.log(`Detected line with angle: ${angle}`);

        const angleDiff = Math.abs(angle);
        isAligned = angleDiff < 10;

        paintMarkFound = true;
        break;
      }
    }

    boltGray.delete();
    boltEdges.delete();
    lines.delete();

    return paintMarkFound ? (isAligned ? "aligned" : "misaligned") : "no-mark";
  };

  return (
    <div className="App">
      <h1>Torque Bolt & Nut Inspection</h1>

      <input type="file" accept="image/*" onChange={handleFileChange} />
      <img ref={imageRef} alt="Preview" width="300px" />

      <button onClick={handleSimulateInspection} disabled={!cvReady}>
        Inspect Image
      </button>

      <canvas id="canvasOutput"></canvas>

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
    </div>
  );
};

export default App;
