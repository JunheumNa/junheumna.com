// Show the skeleton screen
document.getElementById('skeleton-screen').style.display = 'flex';

// Function to calculate loading time and hide skeleton screen
window.addEventListener('load', function() {
  var startTime = performance.now(); // Get start time when the page starts loading
  
  // Function to hide skeleton screen and display loading time
  function hideSkeletonScreen() {
    var endTime = performance.now(); // Get end time when the page finishes loading
    var loadingTime = endTime - startTime; // Calculate loading time in milliseconds
    console.log('Page loaded in ' + loadingTime + ' milliseconds');
    
    // Show skeleton screen for at least 1 second
    var skeletonScreenTimeout = Math.max(1000 - loadingTime, 0);
    setTimeout(function() {
      document.getElementById('skeleton-screen').classList.add('fade-out');
    }, skeletonScreenTimeout);
  }

  hideSkeletonScreen();
});