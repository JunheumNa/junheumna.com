$(window).on('load',function(){
	var grid = document.querySelector('.grid');

	var msnry = new Masonry( grid, {
	  itemSelector: '.grid-item',
	  columnWidth: '.grid-sizer',
	  gutter: '.gutter-sizer',
	  percentPosition: true
	});

	imagesLoaded( grid ).on( 'progress', function() {
	  // layout Masonry after each image loads
	  msnry.layout();
	});
});