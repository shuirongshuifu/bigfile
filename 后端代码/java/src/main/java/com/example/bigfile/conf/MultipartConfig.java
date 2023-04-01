package com.example.bigfile.conf;

import org.springframework.boot.web.servlet.MultipartConfigFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.util.unit.DataSize;
import org.springframework.util.unit.DataUnit;

import javax.servlet.MultipartConfigElement;

public class MultipartConfig {
    @Bean
    public MultipartConfigElement multipartConfigElement() {
        MultipartConfigFactory factory = new MultipartConfigFactory();
        factory.setMaxRequestSize(DataSize.of(500, DataUnit.MEGABYTES));
        factory.setMaxFileSize(DataSize.of(500, DataUnit.MEGABYTES));
        return factory.createMultipartConfig();
    }
}
