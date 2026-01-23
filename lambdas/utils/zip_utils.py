import os
import pyzipper


def zip_encrypt_file(*, input_path: str, output_zip: str, password: str) -> None:
    """
    Create an AES-encrypted ZIP file containing a single file.

    :param input_path: Path to the file to zip
    :param output_zip: Path of the zip file to create
    :param password: Password for AES encryption
    """
    with pyzipper.AESZipFile(
        output_zip,
        "w",
        compression=pyzipper.ZIP_DEFLATED,
        encryption=pyzipper.WZ_AES,
    ) as zf:
        zf.setpassword(password.encode("utf-8"))
        zf.write(input_path, arcname=os.path.basename(input_path))
