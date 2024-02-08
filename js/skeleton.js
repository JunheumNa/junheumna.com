// Function to calculate loading time and show/hide skeleton screen
window.addEventListener('load', function() {
  var startTime = performance.now(); // Get start time when the page starts loading
  
  // Function to calculate and display loading time
  function calculateAndDisplayLoadingTime() {
    var endTime = performance.now(); // Get end time when the page finishes loading
    var loadingTime = endTime - startTime; // Calculate loading time in milliseconds
    console.log('Page loaded in ' + loadingTime + ' milliseconds');
    
    // Show skeleton screen for at least 1 second
    var skeletonScreenTimeout = Math.max(1000 - loadingTime, 0);
    setTimeout(function() {
      document.getElementById('skeleton-screen').classList.add('fade-out');
    }, skeletonScreenTimeout);
  }
  
  // Check if all content (including images, scripts, etc.) has loaded
  if (document.readyState === 'complete') {
    calculateAndDisplayLoadingTime();
  } else {
    window.addEventListener('load', calculateAndDisplayLoadingTime);
  }
});