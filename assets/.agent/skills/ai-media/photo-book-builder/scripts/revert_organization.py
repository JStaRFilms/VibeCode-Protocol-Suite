import os
import shutil
import json
import argparse

def revert_organization(workspace_dir):
    mapping_path = os.path.join(workspace_dir, 'photo_organization_map.json')
    if not os.path.exists(mapping_path):
        print(f"Error: Organization mapping file '{mapping_path}' not found. Cannot revert.")
        return False
        
    try:
        with open(mapping_path, 'r') as f:
            pages = json.load(f)
    except Exception as e:
        print(f"Error reading mapping file: {e}")
        return False
        
    print(f"Reverting files from page folders back to root of: {workspace_dir}")
    for page_num, files in pages.items():
        page_dir = os.path.join(workspace_dir, f"page {page_num}")
        for filename in files:
            src = os.path.join(page_dir, filename)
            dst = os.path.join(workspace_dir, filename)
            if os.path.exists(src):
                try:
                    shutil.move(src, dst)
                except Exception as e:
                    print(f"Error moving {filename} to root: {e}")
            elif os.path.exists(dst):
                # File is already at root
                pass
            else:
                print(f"Warning: File {filename} not found in {page_dir} or {workspace_dir}!")
                
        # Remove page directory if empty
        if os.path.exists(page_dir):
            try:
                if not os.listdir(page_dir):
                    os.rmdir(page_dir)
                    print(f"Removed empty directory: {page_dir}")
                else:
                    print(f"Warning: Directory {page_dir} is not empty, keeping it.")
            except Exception as e:
                print(f"Error removing directory {page_dir}: {e}")
                
    try:
        os.remove(mapping_path)
        print("Removed organization map file.")
    except Exception as e:
        print(f"Error removing mapping file: {e}")
        
    print("Revert complete!")
    return True

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Revert photo organization back to a flat source directory.")
    parser.add_argument("--workspace-dir", required=True, help="Path to the workspace containing page folders.")
    args = parser.parse_args()
    
    revert_organization(args.workspace_dir)
