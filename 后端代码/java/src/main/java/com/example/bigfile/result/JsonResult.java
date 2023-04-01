package com.example.bigfile.result;

public class JsonResult<T> {

    private int resultCode;
    private String resultMsg;
    private Object resultData;

    public JsonResult() {
    }

    public JsonResult(int resultCode, String resultMsg, Object resultData) {
        this.resultCode = resultCode;
        this.resultMsg = resultMsg;
        this.resultData = resultData;
    }

    public int getResultCode() {
        return this.resultCode;
    }

    public void setResultCode(int resultCode) {
        this.resultCode = resultCode;
    }

    public String getResultMsg() {
        return this.resultMsg;
    }

    public void setResultMsg(String resultMsg) {
        this.resultMsg = resultMsg;
    }

    public Object getResultData() {
        return this.resultData;
    }

    public void setResultData(Object resultData) {
        this.resultData = resultData;
    }
}
