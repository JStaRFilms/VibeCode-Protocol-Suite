import os
import argparse
from PIL import Image

def upscale_image(src_path, out_path, target_w, target_h, quality=95):
    if not os.path.exists(src_path):
        print(f"Error: Source image '{src_path}' does not exist!")
        return False
        
    print(f"Loading image: {src_path}")
    try:
        with Image.open(src_path) as img:
            print(f"Original size: {img.size}")
            # Ensure target size is tuple of ints
            target_size = (int(target_w), int(target_h))
            print(f"Upscaling to: {target_size} using Resampling.LANCZOS...")
            
            # Use LANCZOS for high quality down/up sampling
            resized = img.resize(target_size, Image.Resampling.LANCZOS)
            
            # Determine format from extension
            ext = os.path.splitext(out_path)[1].lower()
            save_format = "JPEG" if ext in ['.jpg', '.jpeg'] else "PNG"
            
            # Save the file
            os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
            if save_format == "JPEG":
                resized.convert("RGB").save(out_path, "JPEG", quality=quality)
            else:
                resized.save(out_path, "PNG")
                
            print(f"Successfully saved upscaled image to: {out_path}")
            return True
    except Exception as e:
        print(f"Error upscaling image: {e}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Upscale cover artwork to target print dimensions using LANCZOS.")
    parser.add_argument("--src", required=True, help="Path to the source image.")
    parser.add_argument("--out", required=True, help="Output file path.")
    parser.add_argument("--width", type=int, required=True, help="Target width in pixels.")
    parser.add_argument("--height", type=int, required=True, help="Target height in pixels.")
    parser.add_argument("--quality", type=int, default=95, help="JPEG quality if output is JPEG (default: 95).")
    args = parser.parse_args()
    
    upscale_image(args.src, args.out, args.width, args.height, args.quality)
