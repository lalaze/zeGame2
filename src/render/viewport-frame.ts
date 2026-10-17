/** Expand only the drawing surface; the central authored room keeps its fitted scale. */
export function viewportFrame(room: { width: number; height: number; cssWidth: number; cssHeight: number }, viewport = { width: room.cssWidth, height: room.cssHeight }) {
  const cssWidth = Math.max(room.cssWidth, viewport.width);
  const cssHeight = Math.max(room.cssHeight, viewport.height);
  const width = Math.round(cssWidth * room.width / room.cssWidth);
  const height = Math.round(cssHeight * room.height / room.cssHeight);
  return {
    width, height, cssWidth, cssHeight,
    // Whole drawing-buffer pixels keep the room's art grid on the device grid.
    x: Math.floor((width - room.width) / 2), y: Math.floor((height - room.height) / 2),
    roomWidth: room.width, roomHeight: room.height,
    left: (room.cssWidth - cssWidth) / 2, top: (room.cssHeight - cssHeight) / 2,
  };
}
export function insideRoomFrame(x: number, y: number, frame: { x: number; y: number; roomWidth: number; roomHeight: number }): boolean {
  return x >= frame.x && y >= frame.y && x < frame.x + frame.roomWidth && y < frame.y + frame.roomHeight;
}
