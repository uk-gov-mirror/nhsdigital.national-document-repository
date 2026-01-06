import pytest
from enums.lambda_error import LambdaError
from enums.mtls import MtlsCommonNames
from utils.lambda_exceptions import InvalidDocTypeException


@pytest.mark.parametrize(
    ["common_name", "expected"],
    [
        ("xxx", MtlsCommonNames.PDM),
        ("yyy", MtlsCommonNames.PDM),
        ("zzz", MtlsCommonNames.PDM),
    ],
)
def test_mtls_enum_returned(common_name, expected, monkeypatch):
    monkeypatch.setattr(
        MtlsCommonNames,
        "_get_mtls_common_names",
        classmethod(lambda cls: {"PDM": ["xxx", "yyy", "zzz"]}),
    )
    doc_type_enum = MtlsCommonNames.from_common_name(common_name)
    assert doc_type_enum == expected


@pytest.mark.parametrize(
    "common_name",
    [
        "client.dev.ndr.lloydgeorge.national.nhs.uk",
        "pdm.pdm.pdm",
        "foo.bar",
    ],
)
def test_mtls_enum_error_raised(common_name, monkeypatch):
    monkeypatch.setattr(
        MtlsCommonNames,
        "_get_mtls_common_names",
        classmethod(lambda cls: {"PDM": ["xxx", "yyy", "zzz"]}),
    )
    with pytest.raises(InvalidDocTypeException) as excinfo:
        MtlsCommonNames.from_common_name(common_name)
    assert excinfo.value.status_code == 400
    assert excinfo.value.error == LambdaError.DocTypeInvalid
